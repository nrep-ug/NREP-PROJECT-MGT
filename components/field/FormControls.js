'use client';

import { FIELD_OPTIONS } from '@/lib/cleanCooking/fieldOptions';
import styles from '@/app/field/field.module.css';

/** Large tap-friendly single choice (radio buttons styled as tiles). */
export function Choice({ label, name, options, value, onChange, required, columns = 1, hint }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{label}{required && <span className={styles.req}> *</span>}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.choices} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label key={o.value} className={`${styles.choice} ${value === o.value ? styles.choiceOn : ''}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} required={required} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Multiple choice (checkbox tiles). */
export function MultiChoice({ label, name, options, value = [], onChange, hint, exclusive }) {
  const toggle = (v) => {
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (exclusive && v === exclusive) return onChange([v]);
    return onChange([...value.filter((x) => x !== exclusive), v]);
  };
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{label}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.choices}>
        {options.map((o) => (
          <label key={o.value} className={`${styles.choice} ${value.includes(o.value) ? styles.choiceOn : ''}`}>
            <input type="checkbox" name={name} value={o.value} checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TextField({ label, value, onChange, type = 'text', required, hint, ...rest }) {
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className={styles.fieldset}>
      <label className={styles.label} htmlFor={id}>{label}{required && <span className={styles.req}> *</span>}</label>
      {hint && <p className={styles.hint}>{hint}</p>}
      {type === 'textarea' ? (
        <textarea id={id} className={styles.input} rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required} {...rest} />
      ) : (
        <input id={id} className={styles.input} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required} {...rest} />
      )}
    </div>
  );
}

export function YesNo({ label, value, onChange, hint }) {
  return (
    <Choice
      label={label}
      hint={hint}
      name={label}
      columns={2}
      required
      value={value === true ? 'yes' : value === false ? 'no' : ''}
      onChange={(v) => onChange(v === 'yes')}
      options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
    />
  );
}

/**
 * Customer section shared by the lead and sale forms. Implements the review
 * comments: age group only for individuals (single choice incl. "not known"),
 * institutions give their type, and the customer's name/phone are asked only
 * after they agree to share them.
 */
export function CustomerSection({ value, update }) {
  return (
    <section className={styles.formCard}>
      <h2 className={styles.sectionTitle}>Customer</h2>
      <Choice label="Who is the customer?" name="customerType" options={FIELD_OPTIONS.customerType} value={value.customerType} onChange={(v) => update({ customerType: v })} required />
      {value.customerType === 'individual' && (
        <>
          <Choice label="Gender" name="gender" columns={3} options={FIELD_OPTIONS.gender} value={value.gender} onChange={(v) => update({ gender: v })} />
          <Choice label="Age group" name="ageBand" options={FIELD_OPTIONS.ageBand} value={value.ageBand} onChange={(v) => update({ ageBand: v })} required />
        </>
      )}
      {value.customerType === 'institution' && (
        <>
          <Choice label="Type of institution" name="institutionType" columns={2} options={FIELD_OPTIONS.institutionType} value={value.institutionType} onChange={(v) => update({ institutionType: v })} required />
          <TextField label="Role of the person you spoke to" value={value.contactPersonRole} onChange={(v) => update({ contactPersonRole: v })} placeholder="e.g. Head teacher, cook, manager" maxLength={100} />
        </>
      )}
      <YesNo
        label="Does the customer agree to share their name and phone with NREP?"
        hint="If not, we record the sale/lead without their identity."
        value={value.consentShareIdentity}
        onChange={(v) => update({ consentShareIdentity: v, ...(v ? {} : { customerName: '', customerPhone: '', consentFollowUp: false }) })}
      />
      {value.consentShareIdentity && (
        <>
          <TextField label={value.customerType === 'institution' ? 'Institution name' : 'Customer name'} value={value.customerName} onChange={(v) => update({ customerName: v })} maxLength={160} />
          <TextField label="Customer phone" type="tel" inputMode="tel" value={value.customerPhone} onChange={(v) => update({ customerPhone: v })} placeholder="07XX XXX XXX" />
          <YesNo label="Does the customer agree to be contacted again later?" value={value.consentFollowUp} onChange={(v) => update({ consentFollowUp: v })} />
        </>
      )}
    </section>
  );
}

export function SubmitBar({ pending, label, error, offline }) {
  return (
    <div className={styles.submitBar}>
      {error && <p className={offline ? styles.warning : styles.error} role="alert">{error}</p>}
      <button type="submit" className={styles.primary} disabled={pending}>{pending ? 'Sending…' : label}</button>
    </div>
  );
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
