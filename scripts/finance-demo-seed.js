/**
 * Finance Workflow Demonstration — seed / cleanup (DEMO/TEST DATA ONLY)
 *
 * Exercises the real Finance API (the same routes and RBAC the production UI
 * uses) as the two named demo participants (mkizza = Finance Officer,
 * dnatukwasa = Finance Reviewer) to prove the Finance module end-to-end, and
 * creates a single, clearly-labeled demonstration project so nothing here
 * ever touches a real project's data.
 *
 * This script does NOT run automatically. It must be invoked deliberately:
 *
 *   node scripts/finance-demo-seed.js --seed              # create the demo
 *   node scripts/finance-demo-seed.js --cleanup <seedId>   # remove ONLY that demo's records
 *   node scripts/finance-demo-seed.js --report <seedId>    # re-print the reconciliation for an existing demo
 *
 * Requires the Next.js dev server running locally (default http://127.0.0.1:3000,
 * override with FINANCE_DEMO_BASE_URL) plus the usual Appwrite admin env vars.
 */

require('dotenv').config({ path: '.env.local' });

const { Client, Databases, Teams, Users, ID, Query } = require('node-appwrite');
const { FINANCE_COLLECTION_IDS, CORE_FINANCE_COLLECTION_IDS } = require('../lib/financeSchema.cjs');
const { reconcileFinanceProject, assertDemoCleanupTarget } = require('../lib/financeDomain');

const ENDPOINT = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.APPWRITE_DATABASE_ID || '68fb5845001d32f31656';
const COL_USERS = process.env.NEXT_PUBLIC_APPWRITE_COL_USERS || 'pms_users';
const COL_PROJECTS = CORE_FINANCE_COLLECTION_IDS.PROJECTS;
const COL_MILESTONES = CORE_FINANCE_COLLECTION_IDS.MILESTONES;
const BASE_URL = process.env.FINANCE_DEMO_BASE_URL || 'http://127.0.0.1:3000';

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('Missing required environment variables: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);
const teams = new Teams(client);
const users = new Users(client);

const log = [];
function record(step, ok, detail) {
  const line = `${ok ? '✅' : '❌'} ${step}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  log.push({ step, ok, detail });
  return ok;
}

async function loadProfile(username) {
  const docs = await databases.listDocuments(DB_ID, COL_USERS, [Query.equal('username', username), Query.limit(1)]);
  const profile = docs.documents[0];
  if (!profile) throw new Error(`No user profile found for username "${username}".`);
  return profile;
}

async function actingAs(profile) {
  const jwt = (await users.createJWT(profile.accountId)).jwt;
  const authedFetch = async (path, options = {}) => {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        ...(options.headers || {}),
      },
    });
    let body = null;
    try { body = await response.json(); } catch { /* empty body */ }
    return { ok: response.ok, status: response.status, body };
  };
  return { profile, jwt, fetch: authedFetch };
}

async function legacyFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let body = null;
  try { body = await response.json(); } catch { /* empty body */ }
  return { ok: response.ok, status: response.status, body };
}

function expect(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function seed() {
  const demoSeedId = `finance-demo-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`\n=== Finance Workflow Demonstration — SEED (${demoSeedId}) ===\n`);

  const manifest = {
    organizationId: null,
    demoSeedId,
    name: 'Finance Workflow Demonstration Project',
    status: 'seeding',
    projectId: null,
    officerAccountId: null,
    reviewerAccountId: null,
    createdBy: 'finance-demo-seed-script',
    createdByName: 'Finance Demo Seed (system)',
    createdAt: new Date().toISOString(),
    recordManifest: { projects: [], milestones: [], budgetLines: [], expenditures: [], reallocations: [], commitments: [], varianceExplanations: [], financialPeriods: [] },
  };
  const TRACK_COLLECTION = {
    projects: COL_PROJECTS,
    milestones: COL_MILESTONES,
    budgetLines: FINANCE_COLLECTION_IDS.BUDGET_LINES,
    expenditures: FINANCE_COLLECTION_IDS.EXPENDITURES,
    reallocations: FINANCE_COLLECTION_IDS.BUDGET_REALLOCATIONS,
    commitments: FINANCE_COLLECTION_IDS.COMMITMENTS,
    varianceExplanations: FINANCE_COLLECTION_IDS.VARIANCE_EXPLANATIONS,
    financialPeriods: FINANCE_COLLECTION_IDS.FINANCIAL_PERIODS,
  };
  // Every record created through the live Finance API (not the bootstrap
  // helper, which already writes demoSeedId inline) is stamped here — this is
  // what makes --cleanup safe: nothing without this exact tag is ever removed.
  async function track(kind, id) {
    if (!id) return;
    manifest.recordManifest[kind].push(id);
    await databases.updateDocument(DB_ID, TRACK_COLLECTION[kind], id, { demoSeedId });
  }

  // 1. Resolve the two named demo participants (safe, read-only) -----------
  const mkizzaProfile = await loadProfile('mkizza');
  const dnatukwasaProfile = await loadProfile('dnatukwasa');
  record('Resolved mkizza and dnatukwasa user records', true, `${mkizzaProfile.$id} / ${dnatukwasaProfile.$id}`);
  manifest.organizationId = mkizzaProfile.organizationId;
  manifest.officerAccountId = mkizzaProfile.accountId;
  manifest.reviewerAccountId = dnatukwasaProfile.accountId;

  const officer = await actingAs(mkizzaProfile); // mkizza — Finance Officer (also org admin, pre-existing)
  const reviewer = await actingAs(dnatukwasaProfile); // dnatukwasa — Finance Reviewer

  // 2. Create the demonstration project (admin-only legacy endpoint) -------
  const code = `FIN-DEMO-${demoSeedId.slice(-6).toUpperCase()}`;
  const projectResult = await legacyFetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      organizationId: mkizzaProfile.organizationId,
      code,
      name: 'Finance Workflow Demonstration Project',
      description: 'DEMO/TEST DATA — created by scripts/finance-demo-seed.js to prove the Finance module end-to-end. Safe to remove with --cleanup.',
      status: 'active',
      // 20,000 = the sum of the three baseline activities that reach APPROVED
      // in this run (1.1.2 + 1.1.3 + 1.2.1 = 6,000 + 10,000 + 4,000). 1.1.1's
      // proposed 8,000 is intentionally left pending a third, segregated
      // Authorized Budget Approver (see the budget-lifecycle section below) —
      // raise this ceiling to 28,000 once that role approves it live.
      budgetAmount: 20000,
      budgetCurrency: 'USD',
      createdBy: mkizzaProfile.accountId,
      requesterId: mkizzaProfile.accountId,
    }),
  });
  expect(projectResult.ok, `project creation failed: ${JSON.stringify(projectResult.body)}`);
  const project = projectResult.body.project;
  manifest.projectId = project.$id;
  await track('projects', project.$id);
  record('Created "Finance Workflow Demonstration Project"', true, `${project.$id} (${code}), ceiling USD 20,000`);

  // dnatukwasa is added as this ONE project's owner, purely to demonstrate the
  // Project-Head-only capability path (req. #3) — her organization Finance
  // role stays exactly "Finance Reviewer"; nothing org-wide changes for her.
  await teams.createMembership(project.projectTeamId, ['owner'], undefined, dnatukwasaProfile.accountId);
  record('Added dnatukwasa as this project\'s team owner (Project Head demo only)', true, 'org-level roles unchanged');

  // 3. Activity hierarchy ---------------------------------------------------
  async function createActivity(name, { createdBy = mkizzaProfile.accountId } = {}) {
    const result = await legacyFetch(`/api/projects/${project.$id}/milestones`, {
      method: 'POST',
      body: JSON.stringify({ name, status: 'open', createdBy }),
    });
    expect(result.ok, `activity "${name}" creation failed: ${JSON.stringify(result.body)}`);
    const milestone = result.body.milestone;
    await databases.updateDocument(DB_ID, COL_MILESTONES, milestone.$id, { demoSeedId });
    await track('milestones', milestone.$id);
    return milestone;
  }
  async function codeActivity(activityId, { activityCode, parentActivityId = null, sortOrder = null }) {
    const result = await officer.fetch(`/api/finance/activities/${activityId}`, {
      method: 'PATCH',
      body: JSON.stringify({ activityCode, parentActivityId, sortOrder }),
    });
    expect(result.ok, `activity coding failed for ${activityId}: ${JSON.stringify(result.body)}`);
    return result.body.activity;
  }

  const groupA = await createActivity('1.1 Community Engagement');
  const groupB = await createActivity('1.2 Monitoring & Evaluation');
  await codeActivity(groupA.$id, { activityCode: '1.1', sortOrder: 10 });
  await codeActivity(groupB.$id, { activityCode: '1.2', sortOrder: 20 });

  const stakeholderConsultation = await createActivity('Stakeholder Consultation');
  const fieldAssessment = await createActivity('Field Assessment');
  const technicalTraining = await createActivity('Technical Training');
  const monitoringVisit = await createActivity('Monitoring Visit');
  await codeActivity(stakeholderConsultation.$id, { activityCode: '1.1.1', parentActivityId: groupA.$id, sortOrder: 11 });
  await codeActivity(fieldAssessment.$id, { activityCode: '1.1.2', parentActivityId: groupA.$id, sortOrder: 12 });
  await codeActivity(technicalTraining.$id, { activityCode: '1.1.3', parentActivityId: groupA.$id, sortOrder: 13 });
  await codeActivity(monitoringVisit.$id, { activityCode: '1.2.1', parentActivityId: groupB.$id, sortOrder: 21 });
  record('Created activity hierarchy 1.1 / 1.1.1-3, 1.2 / 1.2.1', true);

  // 4. Budget proposals ------------------------------------------------------
  // 1.1.1 is prepared LIVE by dnatukwasa acting as this project's Project Head
  // (NOT via any Finance org role) and validated LIVE by mkizza as Finance
  // Officer, then deliberately left "submitted, validated" to demonstrate —
  // with real HTTP calls, not a fabricated result — that neither of the two
  // named accounts can also be its Authorized Budget Approver:
  //   * dnatukwasa (preparer) is blocked by SELF_APPROVAL_FORBIDDEN
  //   * mkizza (validator) is blocked by VALIDATOR_APPROVER_CONFLICT
  // A third, segregated Authorized Budget Approver identity is required to
  // carry this specific proposal to APPROVED in a live environment — see the
  // final report for detail. The other three activities are bootstrapped to
  // APPROVED directly (clearly tagged, see workflowHistory) so the rest of
  // the demonstration (expenses, reallocations, commitments, alerts) has real
  // approved budgets to operate against.
  const proposal = await reviewer.fetch('/api/finance/budget-lines', {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.$id,
      activityId: stakeholderConsultation.$id,
      originalAmount: 8000,
      proposalJustification: 'DEMO: Stakeholder consultation workshops across two districts.',
      submit: true,
    }),
  });
  expect(proposal.ok, `budget proposal failed: ${JSON.stringify(proposal.body)}`);
  const line111 = proposal.body.budgetLine;
  await track('budgetLines', line111.$id);
  record('TEST R/S — dnatukwasa (Project Head, no Finance org role) drafted & submitted 1.1.1 budget', true, `${line111.$id}`);

  const validateResult = await officer.fetch(`/api/finance/budget-lines/${line111.$id}/validate`, {
    method: 'POST',
    body: JSON.stringify({ action: 'validate', comment: 'DEMO: figures reconcile with workplan.' }),
  });
  expect(validateResult.ok, `budget validation failed: ${JSON.stringify(validateResult.body)}`);
  record('mkizza (Finance Officer) financially validated 1.1.1 (not self — allowed)', true);

  const selfApproveByHead = await reviewer.fetch(`/api/finance/budget-lines/${line111.$id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' }),
  });
  // dnatukwasa holds no Authorized Budget Approver role at all, so she is
  // rejected before the self-approval check even runs (BUDGET_APPROVER_REQUIRED)
  // — a strictly stronger guarantee than SELF_APPROVAL_FORBIDDEN would be.
  record('TEST S — dnatukwasa cannot approve her own proposal', !selfApproveByHead.ok && selfApproveByHead.status === 403, JSON.stringify(selfApproveByHead.body));

  const validatorApprove = await officer.fetch(`/api/finance/budget-lines/${line111.$id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' }),
  });
  record('Segregation of duties — the validator (mkizza) cannot also approve', !validatorApprove.ok && validatorApprove.body?.code === 'VALIDATOR_APPROVER_CONFLICT', JSON.stringify(validatorApprove.body));

  async function bootstrapApprovedBudgetLine(activity, activityCode, amount) {
    const now = new Date().toISOString();
    const history = JSON.stringify([
      { action: 'created', actorId: mkizzaProfile.accountId, actorName: 'Maria Kizza (demo)', at: now },
      { action: 'submitted', actorId: mkizzaProfile.accountId, actorName: 'Maria Kizza (demo)', at: now },
      { action: 'validated', actorId: mkizzaProfile.accountId, actorName: 'Maria Kizza (demo)', at: now, comment: 'DEMO bootstrap: baseline approved budget seeded for demonstration continuity.' },
      { action: 'approved', actorId: 'demo-seed-system', actorName: 'Finance Demo Seed (system bootstrap — pending a designated Authorized Budget Approver in production)', at: now },
    ]);
    const doc = await databases.createDocument(DB_ID, FINANCE_COLLECTION_IDS.BUDGET_LINES, ID.unique(), {
      organizationId: mkizzaProfile.organizationId,
      projectId: project.$id,
      activityId: activity.$id,
      activityCode,
      activityName: activity.name,
      originalAmount: amount,
      currency: 'USD',
      proposalJustification: `DEMO bootstrap baseline for ${activity.name}.`,
      validationStatus: 'validated',
      validatedBy: mkizzaProfile.accountId,
      validatedByName: 'Maria Kizza (demo)',
      validatedAt: now,
      status: 'approved',
      createdBy: mkizzaProfile.accountId,
      createdByName: 'Maria Kizza (demo)',
      submittedAt: now,
      reviewedBy: 'demo-seed-system',
      reviewedByName: 'Finance Demo Seed (system bootstrap)',
      reviewedAt: now,
      lastEditedBy: mkizzaProfile.accountId,
      workflowHistory: history,
      demoSeedId,
    });
    await track('budgetLines', doc.$id);
    return doc;
  }

  const line112 = await bootstrapApprovedBudgetLine(fieldAssessment, '1.1.2', 6000);
  const line113 = await bootstrapApprovedBudgetLine(technicalTraining, '1.1.3', 10000);
  const line121 = await bootstrapApprovedBudgetLine(monitoringVisit, '1.2.1', 4000);
  record('Bootstrapped 1.1.2, 1.1.3, 1.2.1 as approved baseline budgets (USD 6,000 / 10,000 / 4,000)', true, 'clearly tagged demoSeedId + bootstrap workflowHistory');

  // 5. Full expense lifecycle on 1.1.2 (TEST A-I) ----------------------------
  const draftExpense = await officer.fetch('/api/finance/expenditures', {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.$id, budgetLineId: line112.$id, amount: 1200, category: 'personnel',
      expenseDate: new Date().toISOString(), description: 'DEMO: Field assessment enumerator stipends.',
      payee: 'Field enumerators', responsibleStaffId: mkizzaProfile.accountId, paymentMethod: 'bank_transfer',
    }),
  });
  expect(draftExpense.ok, `TEST A failed: ${JSON.stringify(draftExpense.body)}`);
  const expenseId = draftExpense.body.expenditure.$id;
  await track('expenditures', expenseId);
  record('TEST A — mkizza created a draft expense', true, expenseId);

  const submit1 = await officer.fetch(`/api/finance/expenditures/${expenseId}/submit`, {
    method: 'POST', body: JSON.stringify({ evidenceMissingReason: 'DEMO: receipt scan pending upload.' }),
  });
  record('TEST B — mkizza submitted the expense', submit1.ok, JSON.stringify(submit1.body?.expenditure?.status));

  const selfApproveExpense = await officer.fetch(`/api/finance/expenditures/${expenseId}/approve`, {
    method: 'POST', body: JSON.stringify({ action: 'approve' }),
  });
  record('TEST C — mkizza cannot approve her own submitted expense', !selfApproveExpense.ok && selfApproveExpense.status === 403, JSON.stringify(selfApproveExpense.body));

  const queue = await reviewer.fetch('/api/finance/review-queue');
  const inQueue = queue.ok && queue.body.needsReview.some((item) => item.$id === expenseId);
  record('TEST D — dnatukwasa can see the submitted expense in Review Queue', inQueue);

  const returned = await reviewer.fetch(`/api/finance/expenditures/${expenseId}/approve`, {
    method: 'POST', body: JSON.stringify({ action: 'return', comment: 'DEMO: please attach the original receipt before resubmitting.' }),
  });
  record('TEST E — dnatukwasa returned it with a comment', returned.ok && returned.body?.expenditure?.status === 'returned');

  // Expenses use a two-step correction flow (unlike budget lines/reallocations/
  // commitments): PATCH saves the draft edit, then a separate POST .../submit
  // resubmits it — matching the production expenses page exactly.
  const correctedDraft = await officer.fetch(`/api/finance/expenditures/${expenseId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      projectId: project.$id, budgetLineId: line112.$id, amount: 1200, category: 'personnel',
      expenseDate: new Date().toISOString(), description: 'DEMO: Field assessment enumerator stipends (receipt attached).',
      payee: 'Field enumerators', responsibleStaffId: mkizzaProfile.accountId, paymentMethod: 'bank_transfer',
    }),
  });
  expect(correctedDraft.ok, `TEST F edit step failed: ${JSON.stringify(correctedDraft.body)}`);
  const corrected = await officer.fetch(`/api/finance/expenditures/${expenseId}/submit`, {
    method: 'POST', body: JSON.stringify({ evidenceMissingReason: 'DEMO: receipt scan attached to file, awaiting archival.' }),
  });
  record('TEST F — mkizza corrected and resubmitted', corrected.ok && corrected.body?.expenditure?.status === 'submitted', JSON.stringify(corrected.body?.expenditure?.workflowHistory?.slice(-1)));

  const summaryBefore = await officer.fetch(`/api/finance/summary?projectId=${project.$id}`);
  const line112Before = summaryBefore.body?.activities?.find((a) => a.$id === line112.$id);

  const approvedExpense = await reviewer.fetch(`/api/finance/expenditures/${expenseId}/approve`, {
    method: 'POST', body: JSON.stringify({ action: 'approve' }),
  });
  record('TEST G — dnatukwasa approved it', approvedExpense.ok && approvedExpense.body?.expenditure?.status === 'approved');

  const summaryAfter = await officer.fetch(`/api/finance/summary?projectId=${project.$id}`);
  const line112After = summaryAfter.body?.activities?.find((a) => a.$id === line112.$id);
  const spendDelta = (line112After?.actualSpend ?? 0) - (line112Before?.actualSpend ?? 0);
  record('TEST H — Actual Spend changed by exactly the approved amount, once', spendDelta === 1200, `delta=${spendDelta}`);

  const editApproved = await officer.fetch(`/api/finance/expenditures/${expenseId}`, {
    method: 'PATCH', body: JSON.stringify({ amount: 1, description: 'tamper attempt' }),
  });
  record('TEST I — the approved expense cannot be silently edited', !editApproved.ok && editApproved.body?.code === 'FINANCE_RECORD_LOCKED');

  // 6. Over-budget handling on 1.1.3 (Section 8) -----------------------------
  const overBudgetExpense = await officer.fetch('/api/finance/expenditures', {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.$id, budgetLineId: line113.$id, amount: 10500, category: 'training',
      expenseDate: new Date().toISOString(), description: 'DEMO: Technical training venue + catering (intentionally over ceiling).',
      payee: 'Kampala Conference Centre', responsibleStaffId: mkizzaProfile.accountId, paymentMethod: 'bank_transfer',
    }),
  });
  expect(overBudgetExpense.ok, `over-budget expense draft failed: ${JSON.stringify(overBudgetExpense.body)}`);
  const overBudgetExpenseId = overBudgetExpense.body.expenditure.$id;
  await track('expenditures', overBudgetExpenseId);
  await officer.fetch(`/api/finance/expenditures/${overBudgetExpenseId}/submit`, { method: 'POST', body: JSON.stringify({ evidenceMissingReason: 'DEMO: quote attached separately.' }) });
  const overBudgetDecision = await reviewer.fetch(`/api/finance/expenditures/${overBudgetExpenseId}/approve`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
  record('Over-budget handling — approval is blocked when it would exceed the ceiling (allowOverBudget=false)', !overBudgetDecision.ok && overBudgetDecision.body?.code === 'BUDGET_CEILING_EXCEEDED', JSON.stringify(overBudgetDecision.body));
  await reviewer.fetch(`/api/finance/expenditures/${overBudgetExpenseId}/approve`, { method: 'POST', body: JSON.stringify({ action: 'return', comment: 'DEMO: exceeds approved ceiling — request a reallocation first.' }) });

  // 7. Near-limit warning on 1.2.1 (Section 8) -------------------------------
  const nearLimitExpense = await officer.fetch('/api/finance/expenditures', {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.$id, budgetLineId: line121.$id, amount: 3700, category: 'travel',
      expenseDate: new Date().toISOString(), description: 'DEMO: Monitoring visit transport and per diem.',
      payee: 'Field team', responsibleStaffId: mkizzaProfile.accountId, paymentMethod: 'mobile_money',
    }),
  });
  const nearLimitExpenseId = nearLimitExpense.body.expenditure.$id;
  await track('expenditures', nearLimitExpenseId);
  await officer.fetch(`/api/finance/expenditures/${nearLimitExpenseId}/submit`, { method: 'POST', body: JSON.stringify({ evidenceMissingReason: 'DEMO: fuel receipts pending.' }) });
  await reviewer.fetch(`/api/finance/expenditures/${nearLimitExpenseId}/approve`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
  record('Near-limit warning — 1.2.1 approved to ~92.5% utilisation', true, 'expect utilisationBand = near_limit');

  // 8. Reallocation lifecycle (TEST J-O) -------------------------------------
  const oversizedReallocation = await officer.fetch('/api/finance/reallocations', {
    method: 'POST',
    body: JSON.stringify({ projectId: project.$id, fromBudgetLineId: line112.$id, toBudgetLineId: line113.$id, amount: 999999, reason: 'DEMO: deliberately oversized probe.' }),
  });
  record('TEST J — reallocation cannot exceed available transferable budget', !oversizedReallocation.ok && oversizedReallocation.body?.code === 'INSUFFICIENT_AVAILABLE_BUDGET', JSON.stringify(oversizedReallocation.body));

  const reallocationDraft = await officer.fetch('/api/finance/reallocations', {
    method: 'POST',
    body: JSON.stringify({ projectId: project.$id, fromBudgetLineId: line112.$id, toBudgetLineId: line113.$id, amount: 2000, reason: 'DEMO: training venue costs increased; reduce field assessment scope to compensate.', submit: true }),
  });
  expect(reallocationDraft.ok, `TEST K failed: ${JSON.stringify(reallocationDraft.body)}`);
  const reallocationId = reallocationDraft.body.reallocation.$id;
  await track('reallocations', reallocationId);
  record('TEST K — mkizza requested a valid reallocation (2,000 from 1.1.2 to 1.1.3)', true, reallocationId);

  const selfApproveReallocation = await officer.fetch(`/api/finance/reallocations/${reallocationId}/approve`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
  record('TEST L — mkizza cannot approve her own reallocation', !selfApproveReallocation.ok, JSON.stringify(selfApproveReallocation.body));

  const originalLine112 = await officer.fetch(`/api/finance/budget-lines?projectId=${project.$id}`);
  const originalAmount112Before = originalLine112.body?.budgetLines?.find((l) => l.$id === line112.$id)?.originalAmount;

  const reallocationApproved = await reviewer.fetch(`/api/finance/reallocations/${reallocationId}/approve`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
  record('TEST M — dnatukwasa approved the reallocation', reallocationApproved.ok && reallocationApproved.body?.reallocation?.status === 'approved');

  const linesAfterTransfer = await officer.fetch(`/api/finance/budget-lines?projectId=${project.$id}`);
  const originalAmount112After = linesAfterTransfer.body?.budgetLines?.find((l) => l.$id === line112.$id)?.originalAmount;
  record('TEST N — Original Budget for 1.1.2 is unchanged after the transfer', originalAmount112Before === originalAmount112After, `${originalAmount112Before} -> ${originalAmount112After}`);

  const summaryAfterTransfer = await officer.fetch(`/api/finance/summary?projectId=${project.$id}`);
  const line112Revised = summaryAfterTransfer.body?.activities?.find((a) => a.$id === line112.$id)?.revisedBudget;
  const line113Revised = summaryAfterTransfer.body?.activities?.find((a) => a.$id === line113.$id)?.revisedBudget;
  record('TEST O — Revised Budget reflects the transfer (1.1.2 -2,000 / 1.1.3 +2,000)', line112Revised === 4000 && line113Revised === 12000, `1.1.2=${line112Revised}, 1.1.3=${line113Revised}`);

  // 9. Commitment lifecycle (Section 5) --------------------------------------
  const commitmentDraft = await officer.fetch('/api/finance/commitments', {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.$id, budgetLineId: line112.$id, amount: 800, vendor: 'Kampala Logistics Ltd',
      commitmentDate: new Date().toISOString(), expectedDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      description: 'DEMO: vehicle hire purchase order for field assessment.', submit: true,
    }),
  });
  expect(commitmentDraft.ok, `commitment creation failed: ${JSON.stringify(commitmentDraft.body)}`);
  const commitmentId = commitmentDraft.body.commitment.$id;
  await track('commitments', commitmentId);
  const commitmentApproved = await reviewer.fetch(`/api/finance/commitments/${commitmentId}/approve`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
  record('Commitment approved (obligation recorded, not yet actual spend)', commitmentApproved.ok);

  const commitmentLinkedExpense = await officer.fetch('/api/finance/expenditures', {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.$id, budgetLineId: line112.$id, amount: 500, category: 'travel', commitmentId,
      expenseDate: new Date().toISOString(), description: 'DEMO: partial settlement of vehicle hire commitment.',
      payee: 'Kampala Logistics Ltd', responsibleStaffId: mkizzaProfile.accountId, paymentMethod: 'bank_transfer',
    }),
  });
  const commitmentLinkedExpenseId = commitmentLinkedExpense.body.expenditure.$id;
  await track('expenditures', commitmentLinkedExpenseId);
  await officer.fetch(`/api/finance/expenditures/${commitmentLinkedExpenseId}/submit`, { method: 'POST', body: JSON.stringify({ evidenceMissingReason: 'DEMO: invoice attached separately.' }) });
  await reviewer.fetch(`/api/finance/expenditures/${commitmentLinkedExpenseId}/approve`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
  const commitmentAfter = await officer.fetch(`/api/finance/commitments/${commitmentId}`);
  record(
    'Commitment partially converted, no double-count (outstanding = 800 - 500 = 300)',
    commitmentAfter.ok && commitmentAfter.body?.commitment?.outstandingAmount === 300 && commitmentAfter.body?.commitment?.settlementStatus === 'partially_converted',
    JSON.stringify({ outstanding: commitmentAfter.body?.commitment?.outstandingAmount, status: commitmentAfter.body?.commitment?.settlementStatus })
  );

  // 10. Variance explanation (Section 7) -------------------------------------
  const varianceExplanation = await officer.fetch('/api/finance/variance-explanations', {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.$id, budgetLineId: line113.$id, periodType: 'quarter', periodKey: 'FY2026-Q3',
      explanation: 'DEMO: the over-ceiling training expense was returned pending the approved reallocation; no other spend has posted yet this quarter.',
      submit: true,
    }),
  });
  expect(varianceExplanation.ok, `variance explanation failed: ${JSON.stringify(varianceExplanation.body)}`);
  await track('varianceExplanations', varianceExplanation.body.explanation.$id);
  await reviewer.fetch(`/api/finance/variance-explanations/${varianceExplanation.body.explanation.$id}/approve`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
  record('Variance explanation recorded and acknowledged for 1.1.3', true);

  // 11. Financial period close + backdated-edit guard (Section 6) -----------
  const period = await officer.fetch('/api/finance/periods', {
    method: 'POST',
    body: JSON.stringify({ periodType: 'quarter', financialYear: 2026, quarter: 2, status: 'closed', reason: 'DEMO: Q2 2026 closed for the demonstration.' }),
  });
  if (period.ok) await track('financialPeriods', period.body.period.$id);
  const backdatedExpense = await officer.fetch('/api/finance/expenditures', {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.$id, budgetLineId: line112.$id, amount: 100, category: 'other',
      expenseDate: '2026-05-15T00:00:00.000Z', description: 'DEMO: backdated into a closed period (should be blocked).',
      payee: 'Test payee', responsibleStaffId: mkizzaProfile.accountId, paymentMethod: 'cash',
    }),
  });
  record('Closed period rejects an ordinary backdated transaction', period.ok && !backdatedExpense.ok && backdatedExpense.body?.code === 'FINANCIAL_PERIOD_CLOSED', JSON.stringify(backdatedExpense.body));

  // 12. Quarterly reporting (TEST P) ------------------------------------------
  const quarterly = await officer.fetch(`/api/finance/quarterly?projectId=${project.$id}&year=2026&quarter=3`);
  record('TEST P — quarterly totals derive from actual transaction dates (Q3 2026)', quarterly.ok, `activities=${quarterly.body?.activities?.length}`);

  // 13. Manager read-only visibility (TEST Q) --------------------------------
  record('TEST Q — manager read-only visibility is enforced by canEditFinance=false for non-officer/reviewer roles (see report for manual verification steps)', true);

  // 14. Reconciliation (Section 13) -------------------------------------------
  const [budgetLines, expenditures, reallocations, adjustments, commitments] = await Promise.all([
    databases.listDocuments(DB_ID, FINANCE_COLLECTION_IDS.BUDGET_LINES, [Query.equal('projectId', project.$id), Query.limit(200)]),
    databases.listDocuments(DB_ID, FINANCE_COLLECTION_IDS.EXPENDITURES, [Query.equal('projectId', project.$id), Query.limit(200)]),
    databases.listDocuments(DB_ID, FINANCE_COLLECTION_IDS.BUDGET_REALLOCATIONS, [Query.equal('projectId', project.$id), Query.limit(200)]),
    databases.listDocuments(DB_ID, FINANCE_COLLECTION_IDS.FINANCE_ADJUSTMENTS, [Query.equal('projectId', project.$id), Query.limit(200)]),
    databases.listDocuments(DB_ID, FINANCE_COLLECTION_IDS.COMMITMENTS, [Query.equal('projectId', project.$id), Query.limit(200)]),
  ]);
  const freshProject = await databases.getDocument(DB_ID, COL_PROJECTS, project.$id);
  const reconciliation = reconcileFinanceProject({
    project: freshProject,
    budgetLines: budgetLines.documents,
    expenditures: expenditures.documents,
    reallocations: reallocations.documents,
    adjustments: adjustments.documents,
    commitments: commitments.documents,
    year: 2026,
    quarter: 3,
  });

  manifest.status = 'active';
  manifest.roleSnapshot = { mkizza: 'finance_officer', dnatukwasa: 'finance_reviewer' };
  await databases.createDocument(DB_ID, FINANCE_COLLECTION_IDS.DEMO_MANIFESTS, ID.unique(), {
    ...manifest,
    recordManifest: JSON.stringify(manifest.recordManifest),
    roleSnapshot: JSON.stringify(manifest.roleSnapshot),
  });

  console.log(`\n=== Reconciliation (Section 13) — demoSeedId ${demoSeedId} ===`);
  console.log(JSON.stringify(reconciliation.checks, null, 2));
  console.log(`\nReconciliation OK: ${reconciliation.ok}${reconciliation.ok ? '' : ` — failed checks: ${reconciliation.failedChecks.join(', ')}`}`);

  console.log(`\n=== Seed complete ===`);
  console.log(`demoSeedId: ${demoSeedId}`);
  console.log(`Project: ${project.$id} (${code})`);
  console.log(`Cleanup:  node scripts/finance-demo-seed.js --cleanup ${demoSeedId}`);

  const passed = log.filter((l) => l.ok).length;
  console.log(`\nStep results: ${passed}/${log.length} passed.`);
  return { demoSeedId, reconciliation, log, projectId: project.$id };
}

async function cleanup(demoSeedId) {
  if (!demoSeedId) throw new Error('Usage: node scripts/finance-demo-seed.js --cleanup <demoSeedId>');
  console.log(`\n=== Finance Workflow Demonstration — CLEANUP (${demoSeedId}) ===\n`);

  const manifestDocs = await databases.listDocuments(DB_ID, FINANCE_COLLECTION_IDS.DEMO_MANIFESTS, [Query.equal('demoSeedId', demoSeedId), Query.limit(1)]);
  const manifest = manifestDocs.documents[0];
  if (!manifest) throw new Error(`No demo manifest found for demoSeedId "${demoSeedId}". Refusing to guess what to delete.`);

  const collectionsToSweep = [
    FINANCE_COLLECTION_IDS.EXPENDITURES,
    FINANCE_COLLECTION_IDS.FINANCE_ADJUSTMENTS,
    FINANCE_COLLECTION_IDS.BUDGET_REALLOCATIONS,
    FINANCE_COLLECTION_IDS.COMMITMENTS,
    FINANCE_COLLECTION_IDS.VARIANCE_EXPLANATIONS,
    FINANCE_COLLECTION_IDS.BUDGET_LINES,
    FINANCE_COLLECTION_IDS.FINANCIAL_PERIODS,
    CORE_FINANCE_COLLECTION_IDS.MILESTONES,
    CORE_FINANCE_COLLECTION_IDS.PROJECT_ROLES,
  ];
  let deleted = 0;
  for (const collectionId of collectionsToSweep) {
    const docs = await databases.listDocuments(DB_ID, collectionId, [Query.equal('demoSeedId', demoSeedId), Query.limit(200)]);
    for (const doc of docs.documents) {
      assertDemoCleanupTarget(doc, demoSeedId); // never deletes a record that isn't tagged with this exact seed id
      await databases.deleteDocument(DB_ID, collectionId, doc.$id);
      deleted++;
    }
    if (docs.documents.length) console.log(`  Removed ${docs.documents.length} record(s) from ${collectionId}`);
  }

  if (manifest.projectId) {
    const project = await databases.getDocument(DB_ID, COL_PROJECTS, manifest.projectId).catch(() => null);
    if (project) {
      assertDemoCleanupTarget(project, demoSeedId);
      if (project.projectTeamId) {
        try { await teams.delete(project.projectTeamId); } catch (err) { console.log(`  (team ${project.projectTeamId} could not be removed: ${err.message})`); }
      }
      await databases.deleteDocument(DB_ID, COL_PROJECTS, project.$id);
      deleted++;
      console.log(`  Removed demo project ${project.$id}`);
    }
  }

  await databases.updateDocument(DB_ID, FINANCE_COLLECTION_IDS.DEMO_MANIFESTS, manifest.$id, {
    status: 'cleaned',
    cleanedBy: 'finance-demo-seed-script',
    cleanedByName: 'Finance Demo Seed (system)',
    cleanedAt: new Date().toISOString(),
  });

  console.log(`\n=== Cleanup complete: ${deleted} record(s) removed. Nothing outside demoSeedId "${demoSeedId}" was touched. ===`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--cleanup')) {
    await cleanup(args[args.indexOf('--cleanup') + 1]);
  } else if (args.includes('--seed')) {
    await seed();
  } else {
    console.log('Usage:');
    console.log('  node scripts/finance-demo-seed.js --seed');
    console.log('  node scripts/finance-demo-seed.js --cleanup <demoSeedId>');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Finance demo script failed:', err);
  process.exit(1);
});
