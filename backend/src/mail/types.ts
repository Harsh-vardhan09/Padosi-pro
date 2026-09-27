export type OtpEmail = {
  to: string;
  code: string;
  expiryMinutes: number;
};

export type Mailer = {
  sendOtp(email: OtpEmail): Promise<void>;
};
