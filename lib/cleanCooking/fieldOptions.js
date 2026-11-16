/**
 * Answer options for champion reporting forms — single source of truth for
 * the database enums (schema.cjs), server validation and the field forms.
 *
 * Based on the review comments on the sales tracking (Kobo) form. These are
 * DRAFT until the M&E team approves the final data dictionary; adding options
 * later is safe, renaming existing values is not.
 */

const opt = (value, label) => ({ value, label });

const FIELD_OPTIONS = {
  customerType: [
    opt('individual', 'Individual / household'),
    opt('institution', 'Institution (school, restaurant, health centre…)'),
  ],
  institutionType: [
    opt('school', 'School'),
    opt('restaurant', 'Restaurant / food vendor'),
    opt('health_facility', 'Health facility'),
    opt('faith_based', 'Church / mosque'),
    opt('business', 'Other business'),
    opt('other', 'Other'),
  ],
  // Single choice, individuals only (review comment 2).
  ageBand: [
    opt('18_35', '18–35'),
    opt('36_plus', 'Above 35'),
    opt('unknown', 'Not known / prefer not to say'),
  ],
  gender: [
    opt('female', 'Female'),
    opt('male', 'Male'),
    opt('unspecified', 'Prefer not to say'),
  ],
  leadSource: [
    opt('demonstration', 'Cooking demonstration'),
    opt('community_event', 'Community meeting / event'),
    opt('door_to_door', 'Door-to-door visit'),
    opt('referral', 'Referral (friend, customer)'),
    opt('radio_media', 'Radio / TV / social media'),
    opt('walk_in', 'Walk-in / phone enquiry'),
    opt('other', 'Other'),
  ],
  // Review comment 4.
  leadStage: [
    opt('enquiry_received', 'Enquiry received'),
    opt('demonstration_completed', 'Demonstration completed'),
    opt('quotation_shared', 'Quotation shared'),
    opt('financing_pending', 'Financing pending'),
    opt('converted_to_sale', 'Converted to sale'),
    opt('closed_without_sale', 'Closed without sale'),
  ],
  mainBarrier: [
    opt('none', 'No barrier yet'),
    opt('price', 'Price too high'),
    opt('financing', 'No access to financing / instalments'),
    opt('electricity_cost', 'Worried about electricity cost'),
    opt('electricity_access', 'No / unreliable electricity'),
    opt('cooking_habits', 'Prefers current cooking method'),
    opt('awareness', 'Does not understand how it works'),
    opt('household_decision', 'Needs to consult family'),
    opt('other', 'Other'),
  ],
  // Review comment 3: payment channel and financing are independent.
  paymentChannel: [
    opt('cash', 'Cash'),
    opt('mobile_money', 'Mobile money'),
    opt('bank_transfer', 'Bank transfer'),
    opt('other', 'Other'),
  ],
  financing: [
    opt('paid_in_full', 'Paid in full'),
    opt('instalments', 'Instalments / PAYGo'),
    opt('loan', 'Loan (SACCO, bank, MFI)'),
    opt('subsidy_grant', 'Subsidy / grant / voucher'),
  ],
  followUpMethod: [
    opt('visit', 'Home / site visit'),
    opt('phone_call', 'Phone call'),
  ],
  usageStatus: [
    opt('regular_use', 'Using it regularly'),
    opt('occasional_use', 'Using it sometimes'),
    opt('not_in_use', 'Not using it'),
    opt('not_reached', 'Could not reach the customer'),
  ],
  usageFrequency: [
    opt('daily', 'Every day'),
    opt('several_weekly', 'Several times a week'),
    opt('weekly', 'About once a week'),
    opt('rarely', 'Rarely'),
  ],
  usageBarrier: [
    opt('none', 'No problems'),
    opt('electricity_cost', 'Electricity cost'),
    opt('power_outages', 'Power cuts / no electricity'),
    opt('broken', 'Cooker faulty or broken'),
    opt('dont_know_how', 'Not sure how to use it for some foods'),
    opt('food_taste', 'Food taste / preference'),
    opt('family_resistance', 'Family prefers old method'),
    opt('other', 'Other'),
  ],
  verificationStatus: [
    opt('submitted', 'Submitted'),
    opt('verified', 'Verified'),
    opt('needs_review', 'Needs review'),
    opt('rejected', 'Rejected'),
  ],
};

const values = (key) => FIELD_OPTIONS[key].map((o) => o.value);
const labelOf = (key, value) => FIELD_OPTIONS[key]?.find((o) => o.value === value)?.label || value || '—';

/** Lead stages that still need work (shown as "open"). */
const OPEN_LEAD_STAGES = ['enquiry_received', 'demonstration_completed', 'quotation_shared', 'financing_pending'];

/** A sale becomes "follow-up due" this many days after the sale date. */
const FOLLOW_UP_AFTER_DAYS = 30;

module.exports = { FIELD_OPTIONS, OPEN_LEAD_STAGES, FOLLOW_UP_AFTER_DAYS, labelOf, values };
