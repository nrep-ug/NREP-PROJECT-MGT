/**
 * Champion portal login for one champion.
 * POST:   create the login, or reset the password (and re-enable) if it exists.
 *         Returns the new starting password ONCE — it is not stored anywhere.
 * DELETE: disable the login and sign the champion out everywhere.
 * Project owner/manager or organization admin only.
 */
import { adminDatabases, adminUsers, DB_ID, ID } from '@/lib/appwriteAdmin';
import { CC, ccHandler, getProjectDocument, HttpError } from '@/lib/cleanCooking/service';
import {
  assertPermissionsHardened,
  championLoginEmail,
  FIELD_LABEL,
  generateStartingPassword,
} from '@/lib/cleanCooking/championAccounts';

function localPhone(e164) {
  return e164 ? `0${e164.replace(/^\+256/, '')}` : '';
}

export const POST = ccHandler('manage', async ({ params }) => {
  const champion = await getProjectDocument(CC.CHAMPIONS, params.championId, params.projectId, 'Champion');
  if (champion.status === 'inactive') {
    throw new HttpError(400, 'This champion is marked inactive. Mark them active first.', 'CHAMPION_INACTIVE');
  }
  if (!champion.phone) {
    throw new HttpError(400, 'Add the champion’s phone number first — it is their login.', 'PHONE_REQUIRED');
  }
  await assertPermissionsHardened();

  const email = championLoginEmail(champion.phone);
  const password = generateStartingPassword();

  if (champion.accountId) {
    let user;
    try {
      user = await adminUsers.get(champion.accountId);
    } catch (error) {
      if (error?.code !== 404) throw error;
    }
    if (user) {
      if ((user.labels || []).some((l) => l !== FIELD_LABEL)) {
        throw new HttpError(409, 'This login belongs to a staff account and cannot be managed here.', 'NOT_A_FIELD_ACCOUNT');
      }
      if (user.email !== email) await adminUsers.updateEmail(user.$id, email);
      if (user.phone !== champion.phone) await adminUsers.updatePhone(user.$id, champion.phone);
      await adminUsers.updatePassword(user.$id, password);
      await adminUsers.updateStatus(user.$id, true);
      await adminUsers.deleteSessions(user.$id);
      return { reset: true, login: localPhone(champion.phone), password };
    }
  }

  let user;
  try {
    user = await adminUsers.create(ID.unique(), email, champion.phone, password, champion.fullName);
  } catch (error) {
    if (error?.code === 409) {
      throw new HttpError(409, 'This phone number already has an NREP login. Use a different number or contact an administrator.', 'PHONE_IN_USE');
    }
    throw error;
  }
  await adminUsers.updateLabels(user.$id, [FIELD_LABEL]);
  await adminDatabases.updateDocument(DB_ID, CC.CHAMPIONS, champion.$id, { accountId: user.$id });
  return { created: true, login: localPhone(champion.phone), password };
}, { status: 201 });

export const DELETE = ccHandler('manage', async ({ params }) => {
  const champion = await getProjectDocument(CC.CHAMPIONS, params.championId, params.projectId, 'Champion');
  if (!champion.accountId) throw new HttpError(404, 'This champion has no login.', 'NO_LOGIN');
  const user = await adminUsers.get(champion.accountId);
  if ((user.labels || []).some((l) => l !== FIELD_LABEL)) {
    throw new HttpError(409, 'This login belongs to a staff account and cannot be managed here.', 'NOT_A_FIELD_ACCOUNT');
  }
  await adminUsers.updateStatus(user.$id, false);
  await adminUsers.deleteSessions(user.$id);
  return { disabled: true };
});
