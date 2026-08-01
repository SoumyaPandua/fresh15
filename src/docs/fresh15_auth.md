# Fresh15 Authentication API Documentation
## 1. Overview
Fresh15 authentication supports three portals:
- `customer` — Fresh Groceries UI
- `partner` — Fresh15 Partner Hub
- `platform` — Fresh15 Platform Hub
Authentication uses:
- MongoDB for permanent user/account data
- Upstash Redis with `ioredis` for temporary OTP storage
- `bcryptjs` for password hashing
- JWT for authenticated sessions
- JWT reset tokens for password reset
- SMTP/Nodemailer for OTP emails
Base authentication path:
```text
/api/auth
```
---
## 2. Main Auth Files
```text
src/modules/auth/auth.routes.js
src/modules/auth/auth.controller.js
src/modules/auth/auth.service.js
src/modules/auth/auth.validation.js
src/modules/user/user.model.js
src/config/redis.js
src/config/env.js
src/config/mailer.js
src/middleware/auth.middleware.js
src/middleware/authorize.middleware.js
src/middleware/validateRequest.middleware.js
src/utils/generateOtp.js
src/utils/generateToken.js
src/utils/sendEmail.js
src/utils/sendResponse.js
src/templates/otpTemplate.js
```
---
## 3. User Data
Users are permanently stored in MongoDB.
Main fields:
```text
name
email
phone
password
role
portal
profileImage
isEmailVerified
isActive
createdAt
updatedAt
```
Roles:
```text
SUPER_ADMIN
ADMIN
PARTNER
CUSTOMER
```
Portals:
```text
platform
partner
customer
```
Passwords are stored as bcrypt hashes. OTP values are not supposed to be stored in MongoDB anymore.
---
## 4. Redis OTP Storage
Redis connection:
```text
src/config/redis.js
```
Environment variable:
```env
UPSTASH_REDIS_URL=rediss://default:<PASSWORD>@<HOST>:6379
```
Registration OTP key:
```text
otp:REGISTER:<email>
```
Example:
```text
otp:REGISTER:user@example.com
```
Forgot-password OTP key:
```text
otp:FORGOT_PASSWORD:<email>
```
Example:
```text
otp:FORGOT_PASSWORD:user@example.com
```
OTP TTL:
```text
600 seconds
10 minutes
```
Redis command conceptually:
```javascript
await redis.set(key, otp, "EX", 600);
```
Read OTP:
```javascript
await redis.get(key);
```
Delete OTP:
```javascript
await redis.del(key);
```
Only the latest OTP for the same email and purpose remains valid because `SET` overwrites the existing key.
---
# 5. API Summary
| Method | API | Auth | Work |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register user and send OTP |
| POST | `/api/auth/verify-otp` | No | Verify registration/reset OTP |
| POST | `/api/auth/resend-otp` | No | Resend registration OTP |
| POST | `/api/auth/login` | No | Login and generate JWT |
| POST | `/api/auth/forgot-password` | No | Send password-reset OTP |
| POST | `/api/auth/reset-password` | Reset token | Set new password |
| GET | `/api/auth/me` | Bearer JWT | Get logged-in user |
---
# 6. Register API
## Endpoint
```http
POST /api/auth/register
```
Authentication:
```text
Not required
```
Purpose:
```text
Create a new user.
Store the user permanently in MongoDB.
Generate a registration OTP.
Store the OTP temporarily in Redis.
Send the OTP to the user's email.
```
## Customer Request
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "password123",
  "portal": "customer"
}
```
## Partner Request
```json
{
  "name": "Delivery Partner",
  "email": "partner@example.com",
  "phone": "9876543210",
  "password": "password123",
  "portal": "partner"
}
```
## Platform Request
The current validation also accepts:
```json
{
  "name": "Platform User",
  "email": "platform@example.com",
  "phone": "9876543210",
  "password": "password123",
  "portal": "platform"
}
```
## Validation
`name`
```text
Required
Cannot be empty
```
`email`
```text
Required
Must be valid email
```
`password`
```text
Required
Minimum 6 characters
```
`portal`
Must be:
```text
customer
partner
platform
```
## Processing
```text
Request
  ↓
Validate request
  ↓
Lowercase email
  ↓
Check whether email already exists
  ↓
Hash password using bcrypt
  ↓
Create user in MongoDB
  ↓
isEmailVerified = false
  ↓
Generate 6-digit OTP
  ↓
Store OTP in Redis for 10 minutes
  ↓
Send OTP email
  ↓
Return registration response
```
Redis registration key:
```text
otp:REGISTER:<email>
```
Example:
```text
otp:REGISTER:john@example.com
```
## Success Response
HTTP:
```text
201 Created
```
```json
{
  "success": true,
  "message": "Registration successful. OTP sent to email.",
  "data": {
    "id": "<user-id>",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```
## Existing Email
```json
{
  "success": false,
  "message": "Email already registered",
  "data": null
}
```
## Validation Error
Example:
```json
{
  "success": false,
  "message": "Validation Failed",
  "data": [
    {
      "msg": "Name is required",
      "path": "name",
      "location": "body"
    }
  ]
}
```
## Important Registration State
Immediately after registration:
```text
User exists in MongoDB
isEmailVerified = false
OTP exists in Redis
```
The user cannot successfully login until email verification is complete.
---
# 7. Verify OTP API
## Endpoint
```http
POST /api/auth/verify-otp
```
Authentication:
```text
Not required
```
This single API handles:
```text
REGISTER
FORGOT_PASSWORD
```
The behavior depends on the `purpose` field.
---
## 7.1 Verify Registration OTP
Request:
```json
{
  "email": "john@example.com",
  "otp": "483921",
  "purpose": "REGISTER"
}
```
Redis key:
```text
otp:REGISTER:john@example.com
```
Processing:
```text
Receive email + OTP + purpose
  ↓
Lowercase email
  ↓
Create Redis key
  ↓
Read OTP from Redis
  ↓
OTP missing?
  ├── Yes → OTP expired
  └── No
       ↓
Compare OTP
       ↓
Wrong?
  ├── Yes → Invalid OTP
  └── No
       ↓
Find MongoDB user
       ↓
Set isEmailVerified = true
       ↓
Save user
       ↓
Delete Redis OTP
       ↓
Success
```
Success:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": null
}
```
Invalid OTP:
```json
{
  "success": false,
  "message": "Invalid OTP",
  "data": null
}
```
Expired/missing OTP:
```json
{
  "success": false,
  "message": "OTP expired",
  "data": null
}
```
User missing:
```json
{
  "success": false,
  "message": "User not found",
  "data": null
}
```
After success:
```text
MongoDB:
isEmailVerified = true
Redis:
otp:REGISTER:<email> deleted
```
The OTP becomes single-use.
---
## 7.2 Verify Forgot-Password OTP
Request:
```json
{
  "email": "john@example.com",
  "otp": "724105",
  "purpose": "FORGOT_PASSWORD"
}
```
Redis key:
```text
otp:FORGOT_PASSWORD:john@example.com
```
Processing:
```text
Read OTP from Redis
  ↓
Validate OTP
  ↓
Generate reset JWT
  ↓
Delete Redis OTP
  ↓
Return resetToken
```
Reset JWT payload:
```json
{
  "email": "john@example.com",
  "purpose": "RESET_PASSWORD"
}
```
Reset token expiry:
```text
10 minutes
```
Expected success:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "resetToken": "<reset-jwt-token>"
  }
}
```
### Current Backend Fix Required
The current forgot-password verification branch still contains the old MongoDB
OTP deletion:
```javascript
await Otp.deleteMany({
  email,
  purpose
});
```
It must be replaced with:
```javascript
await redis.del(key);
```
Otherwise correct forgot-password OTP verification can fail because `Otp` is no longer imported.
---
# 8. Resend OTP API
## Endpoint
```http
POST /api/auth/resend-otp
```
Authentication:
```text
Not required
```
Purpose:
```text
Generate a new REGISTER OTP for an unverified user.
```
Request:
```json
{
  "email": "john@example.com"
}
```
Processing:
```text
Lowercase email
  ↓
Find MongoDB user
  ↓
User missing?
  ├── Yes → User not found
  └── No
       ↓
Already verified?
  ├── Yes → Email already verified
  └── No
       ↓
Generate new OTP
       ↓
SET otp:REGISTER:<email>
       ↓
Old OTP overwritten
       ↓
TTL reset to 10 minutes
       ↓
Send email
```
Success:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": null
}
```
User missing:
```json
{
  "success": false,
  "message": "User not found",
  "data": null
}
```
Already verified:
```json
{
  "success": false,
  "message": "Email already verified",
  "data": null
}
```
Important:
```text
Old OTP → invalid
New OTP → valid for 10 minutes
```
---
# 9. Login API
## Endpoint
```http
POST /api/auth/login
```
Authentication:
```text
Not required
```
## Customer Login
```json
{
  "email": "john@example.com",
  "password": "password123",
  "portal": "customer"
}
```
## Partner Login
```json
{
  "email": "partner@example.com",
  "password": "password123",
  "portal": "partner"
}
```
## Platform Login
```json
{
  "email": "admin@example.com",
  "password": "password123",
  "portal": "platform"
}
```
Processing:
```text
Lowercase email
  ↓
Find MongoDB user
  ↓
User missing?
  ├── Yes → Invalid email or password
  └── No
       ↓
Check portal
       ↓
Wrong portal?
  ├── Yes → Unauthorized portal
  └── No
       ↓
Check isEmailVerified
       ↓
False?
  ├── Yes → Please verify your email
  └── No
       ↓
Check isActive
       ↓
False?
  ├── Yes → Account is disabled
  └── No
       ↓
bcrypt.compare()
       ↓
Wrong password?
  ├── Yes → Invalid email or password
  └── No
       ↓
Generate JWT
       ↓
Return token + user
```
## JWT Payload
Login JWT contains:
```json
{
  "id": "<user-id>"
}
```
Secret:
```text
JWT_SECRET
```
Expiration:
```text
JWT_EXPIRE
```
Example:
```env
JWT_EXPIRE=7d
```
## Success Response
General current response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<jwt-token>",
    "user": {
      "_id": "<user-id>",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "role": "CUSTOMER",
      "portal": "customer",
      "profileImage": "",
      "isEmailVerified": true,
      "isActive": true
    }
  }
}
```
## Invalid Credentials
```json
{
  "success": false,
  "message": "Invalid email or password",
  "data": null
}
```
## Wrong Portal
```json
{
  "success": false,
  "message": "Unauthorized portal",
  "data": null
}
```
## Email Not Verified
```json
{
  "success": false,
  "message": "Please verify your email",
  "data": null
}
```
## Disabled Account
```json
{
  "success": false,
  "message": "Account is disabled",
  "data": null
}
```
### Important Security Fix
The current `loginService()` returns the Mongoose user document.
Make sure the returned user object does not include:
```text
password
```
The frontend should never receive the bcrypt password hash.
---
# 10. Forgot Password API
## Endpoint
```http
POST /api/auth/forgot-password
```
Authentication:
```text
Not required
```
Purpose:
```text
Send an OTP that allows the user to start password reset.
```
Request:
```json
{
  "email": "john@example.com"
}
```
Processing:
```text
Lowercase email
  ↓
Find user
  ↓
User missing?
  ├── Yes → User not found
  └── No
       ↓
Generate OTP
       ↓
Store in Redis
       ↓
otp:FORGOT_PASSWORD:<email>
       ↓
TTL = 10 minutes
       ↓
Send OTP email
```
Success:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": null
}
```
User missing:
```json
{
  "success": false,
  "message": "User not found",
  "data": null
}
```
Redis example:
```text
KEY:
otp:FORGOT_PASSWORD:john@example.com
VALUE:
724105
TTL:
600 seconds
```
Next API:
```text
POST /api/auth/verify-otp
```
with:
```text
purpose = FORGOT_PASSWORD
```
---
# 11. Reset Password API
## Endpoint
```http
POST /api/auth/reset-password
```
Login authentication:
```text
Not required
```
Required:
```text
Valid resetToken generated after FORGOT_PASSWORD OTP verification
```
Request:
```json
{
  "token": "<reset-token>",
  "password": "newPassword123"
}
```
Processing:
```text
Receive reset token + new password
  ↓
jwt.verify(token, JWT_SECRET)
  ↓
Invalid/expired?
  ├── Yes → Invalid or expired reset token
  └── No
       ↓
Read email from token
       ↓
Find MongoDB user
       ↓
Hash new password
       ↓
Save new bcrypt hash
       ↓
Return success
```
Success:
```json
{
  "success": true,
  "message": "Password reset successful",
  "data": null
}
```
Invalid/expired token:
```json
{
  "success": false,
  "message": "Invalid or expired reset token",
  "data": null
}
```
User missing:
```json
{
  "success": false,
  "message": "User not found",
  "data": null
}
```
After success, login again using:
```text
POST /api/auth/login
```
and the new password.
---
# 12. Current User API
## Endpoint
```http
GET /api/auth/me
```
Authentication:
```text
Required
```
Header:
```http
Authorization: Bearer <login-token>
```
Request body:
```text
None
```
Processing:
```text
Read Authorization header
  ↓
Extract Bearer token
  ↓
Verify JWT using JWT_SECRET
  ↓
Read decoded.id
  ↓
Find MongoDB user
  ↓
Exclude password
  ↓
Set req.user
  ↓
Return current user
```
Success:
```json
{
  "success": true,
  "message": "Current user",
  "data": {
    "_id": "<user-id>",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "role": "CUSTOMER",
    "portal": "customer",
    "profileImage": "",
    "isEmailVerified": true,
    "isActive": true,
    "createdAt": "<date>",
    "updatedAt": "<date>"
  }
}
```
Missing token:
HTTP:
```text
401
```
```json
{
  "success": false,
  "message": "Unauthorized"
}
```
Invalid/expired token:
HTTP:
```text
401
```
```json
{
  "success": false,
  "message": "Invalid token"
}
```
User no longer exists:
HTTP:
```text
401
```
```json
{
  "success": false,
  "message": "User not found"
}
```
---
