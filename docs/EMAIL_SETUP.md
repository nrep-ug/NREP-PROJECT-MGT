# Email Notifications Setup

This guide explains how to set up email notifications for the NREP Project Management System.

## Prerequisites

1. **Install nodemailer**:
   ```bash
   npm install nodemailer
   ```

## Configuration

### 1. Gmail Setup (Recommended for Development)

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or any device)
   - Click "Generate"
   - Copy the 16-character password

3. Add to `.env.local`:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   EMAIL_FROM=NREP PMS <noreply@your-domain.com>
   ```

### 2. Other SMTP Providers

**SendGrid:**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=NREP PMS <noreply@your-domain.com>
```

**Mailgun:**
```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=postmaster@your-domain.mailgun.org
EMAIL_PASSWORD=your-mailgun-password
EMAIL_FROM=NREP PMS <noreply@your-domain.com>
```

**AWS SES:**
```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_USER=your-ses-smtp-username
EMAIL_PASSWORD=your-ses-smtp-password
EMAIL_FROM=NREP PMS <noreply@your-verified-domain.com>
```

## Development Mode

If email credentials are not configured or `NODE_ENV=development`, emails will be logged to the console instead of being sent. This allows you to develop without configuring email services.

## Notification Types

The system supports the following notification types:

### 1. Timesheet Submitted
Sent to managers when an employee submits a timesheet for approval.

### 2. Timesheet Approved
Sent to employees when their timesheet is approved.

### 3. Timesheet Rejected
Sent to employees when their timesheet is rejected, including feedback comments.

## API Usage

The notification API is located at `/api/notifications` and is called internally by the system. You typically don't need to call it directly.

**Example internal usage:**
```javascript
// In timesheet approval code
await fetch('/api/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'timesheet_approved',
    data: {
      to: 'employee@example.com',
      employeeName: 'John Doe',
      weekStart: '2024-10-27',
      approvedBy: 'Jane Manager'
    }
  })
});
```

## Testing

### Test Email Sending

You can test email sending using the notifications API:

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "type": "timesheet_approved",
    "data": {
      "to": "test@example.com",
      "employeeName": "Test User",
      "weekStart": "2024-10-27",
      "approvedBy": "Manager Name"
    }
  }'
```

## Troubleshooting

### Gmail "Less Secure Apps" Error
- Ensure 2FA is enabled
- Use an App Password, not your regular Gmail password

### Connection Timeout
- Check your firewall allows outbound connections on port 587
- Try port 465 with `secure: true`

### Authentication Failed
- Verify credentials are correct
- For Gmail, ensure you're using the App Password
- Check if the SMTP server requires specific authentication

## Production Considerations

1. **Use a dedicated email service** (SendGrid, Mailgun, AWS SES) instead of Gmail
2. **Set up SPF and DKIM records** for your domain to avoid spam filters
3. **Monitor email delivery** and bounce rates
4. **Implement rate limiting** to prevent abuse
5. **Queue emails** for better performance (consider using a job queue like Bull or BeeQueue)

## Future Enhancements (TODO)

- [ ] Add in-app notifications
- [ ] Configure notification preferences per user
- [ ] Add digest emails (daily/weekly summaries)
- [ ] Implement notification templates in database
- [ ] Add SMS notifications via Twilio
- [ ] Track email delivery status
