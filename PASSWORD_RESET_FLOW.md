# Password Reset/Recovery Flow

This document explains the password reset functionality implemented using Appwrite's Account service APIs.

## 📋 Overview

The password reset flow consists of three pages:
1. **Login Page** (`/login`) - Contains "Forgot password?" link
2. **Forgot Password Page** (`/forgot-password`) - User requests password reset
3. **Reset Password Page** (`/reset-password`) - User sets new password

## 🔐 How It Works

### Step 1: User Requests Password Reset
**Page:** `/forgot-password`

1. User clicks "Forgot password?" link on login page
2. User enters their email address
3. System calls `account.createRecovery(email, resetUrl)`
4. Appwrite sends an email with a recovery link to the user
5. Success message is displayed

**Appwrite API Used:**
```javascript
const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
const resetUrl = `${appUrl}/reset-password`;

await account.createRecovery(
  email,
  resetUrl
);
```

**Note:** The reset URL uses the `NEXT_PUBLIC_APP_URL` environment variable for consistency across environments, with a fallback to `window.location.origin`.

### Step 2: User Clicks Email Link
Appwrite sends an email with a link like:
```
http://localhost:3001/reset-password?userId=abc123&secret=xyz789
```

The URL contains:
- `userId`: The user's ID
- `secret`: A one-time secret token for verification

### Step 3: User Sets New Password
**Page:** `/reset-password`

1. Page extracts `userId` and `secret` from URL parameters
2. User enters and confirms new password
3. Password validation ensures:
   - At least 8 characters
   - One uppercase letter
   - One lowercase letter
   - One number
4. System calls `account.updateRecovery(userId, secret, newPassword)`
5. Success message is displayed
6. User is automatically redirected to login page

**Appwrite API Used:**
```javascript
await account.updateRecovery(
  userId,
  secret,
  newPassword,
  newPassword // Confirmation
);
```

## 🎨 UI/UX Features

### Forgot Password Page Features:
- Email input with validation
- Loading states during API calls
- Success confirmation with instructions
- Option to try again if email not received
- Link back to login page

### Reset Password Page Features:
- Real-time password strength validation
- Visual indicators for password requirements
- Password visibility toggle
- Password confirmation field
- Match validation between password fields
- Success animation
- Automatic redirect to login after success

## 🔒 Security Features

1. **One-time Secret Tokens**: Each reset link can only be used once
2. **Token Expiration**: Reset links expire after a set time (configured in Appwrite)
3. **Password Strength Requirements**: Enforced minimum security standards
4. **Encrypted Communication**: All API calls use HTTPS
5. **No Password Exposure**: Passwords never appear in URLs or logs

## 📧 Email Configuration

**Important:** You need to configure email settings in your Appwrite Console:

1. Go to Appwrite Console → Settings → SMTP
2. Configure your SMTP server settings
3. Set up email templates for password recovery
4. Test email delivery

### Default Email Template Variables:
- `{{user}}` - User's name
- `{{redirect}}` - Reset password URL with userId and secret
- `{{project}}` - Your project name

## 🧪 Testing the Flow

### Test Locally:
1. Start development server: `npm run dev`
2. Navigate to `http://localhost:3001/login`
3. Click "Forgot password?"
4. Enter a test user's email
5. Check email inbox (or Appwrite console logs)
6. Click the reset link
7. Set new password
8. Sign in with new password

### Required Configuration:
- Appwrite project must have email service configured
- User must exist in Appwrite Auth
- Email must match a registered user's email
- `NEXT_PUBLIC_APP_URL` environment variable set in `.env.local`

## 🚨 Error Handling

The implementation handles various error scenarios:

### Forgot Password Page:
- Invalid email format
- User not found
- Email service unavailable
- Network errors

### Reset Password Page:
- Missing or invalid URL parameters
- Expired reset token
- Password doesn't meet requirements
- Passwords don't match
- Network errors

## 📝 Customization

### Update Reset URL:
The reset URL is automatically constructed using the `NEXT_PUBLIC_APP_URL` environment variable from your `.env.local` file:

```javascript
const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
const resetUrl = `${appUrl}/reset-password`;
```

**Environment Variable Setup:**
Add to your `.env.local` file:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

For production:
```env
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

### Change Password Requirements:
In `/app/reset-password/page.js`, modify the `validatePassword` function:
```javascript
const validatePassword = (pwd) => {
  // Add or modify validation rules
};
```

### Customize Success Messages:
Update the success state JSX in both pages to match your branding.

### Update Email Template:
Configure in Appwrite Console → Auth → Templates → Password Recovery

## 🔗 Page Links

- **Login:** `/login`
- **Forgot Password:** `/forgot-password`
- **Reset Password:** `/reset-password?userId=xxx&secret=xxx`

## 📱 Responsive Design

All pages use the same responsive design system as the login page:
- Mobile-first approach
- Split-screen layout on desktop
- Stacked layout on mobile
- Touch-friendly controls
- Optimized for all screen sizes

## 🎯 Future Enhancements

Possible improvements:
- [ ] Add rate limiting for password reset requests
- [ ] Implement CAPTCHA for security
- [ ] Add "Resend email" functionality with cooldown
- [ ] Support for SMS-based password reset
- [ ] Password history to prevent reuse
- [ ] Two-factor authentication integration
- [ ] Custom email templates
- [ ] Admin notifications for password resets

## 🐛 Troubleshooting

### Email Not Received:
1. Check spam/junk folder
2. Verify SMTP configuration in Appwrite
3. Check Appwrite logs for email errors
4. Ensure email service is enabled in Appwrite project

### Reset Link Doesn't Work:
1. Check if link has expired (default: 1 hour)
2. Verify userId and secret are in URL
3. Ensure user exists in Appwrite
4. Check browser console for errors

### Password Reset Fails:
1. Verify password meets all requirements
2. Check network connection
3. Ensure Appwrite service is running
4. Check browser console for API errors

## 📚 Appwrite Documentation

For more information:
- [Appwrite Account API](https://appwrite.io/docs/client/account)
- [Password Recovery](https://appwrite.io/docs/client/account#accountCreateRecovery)
- [Email Configuration](https://appwrite.io/docs/email)
