const otpTemplate = (name, otp) => {
    return `
        <h2>Hello ${name}</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>Valid for 10 minutes.</p>
    `;
};

export default otpTemplate;