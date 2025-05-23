import { adminModel } from "../../models/admin/admin-schema";
import bcrypt from "bcryptjs";
import { Response } from "express";
import { errorResponseHandler } from "../../lib/errors/error-response-handler";
import { httpStatusCode } from "../../lib/constant";
import { sendPasswordResetEmail } from "src/utils/mails/mail";
import {
  generatePasswordResetToken,
  getPasswordResetTokenByToken,
} from "src/utils/mails/token";
import { passwordResetTokenModel } from "src/models/password-token-schema";
import { sendNotification } from "src/utils/FCM/FCM";
import { usersModel } from "src/models/user/user-schema";


export const forgotPasswordService = async (email: string, res: Response) => {
  const admin = await adminModel.findOne({ email: email }).select("+password");
  if (!admin)
    return errorResponseHandler(
      "Email not found",
      httpStatusCode.NOT_FOUND,
      res
    );
  const passwordResetToken = await generatePasswordResetToken(email);
  console.log("passwordResetToken: ", passwordResetToken);
  if (passwordResetToken !== null) {
    await sendPasswordResetEmail(email, passwordResetToken.token, "eng");
    return { success: true, message: "Password reset email sent with otp" };
  }
};
export const newPassswordAfterOTPVerifiedService = async (
  payload: { password: string; otp: string },
  res: Response
) => {
  const { password, otp } = payload;

  const existingToken = await getPasswordResetTokenByToken(otp);
  if (!existingToken)
    return errorResponseHandler("Invalid OTP", httpStatusCode.BAD_REQUEST, res);

  const hasExpired = new Date(existingToken.expires) < new Date();
  if (hasExpired)
    return errorResponseHandler("OTP expired", httpStatusCode.BAD_REQUEST, res);

  let existingAdmin: any;

  if (existingToken.email) {
    existingAdmin = await adminModel.findOne({ email: existingToken.email });
  } else if (existingToken.phoneNumber) {
    existingAdmin = await adminModel.findOne({
      phoneNumber: existingToken.phoneNumber,
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const response = await adminModel.findByIdAndUpdate(
    existingAdmin._id,
    { password: hashedPassword },
    { new: true }
  );
  await passwordResetTokenModel.findByIdAndDelete(existingToken._id);

  return {
    success: true,
    message: "Password updated successfully",
    data: response,
  };
};
export const getAdminDetailsService = async (payload: any, res: Response) => {
  const results = await adminModel.find();
  return {
    success: true,
    data: results,
  };
};

//**************For Testing**************/
export const sendPushNotificationServices = async (payload: any, res: Response) => {
  const { title, description } = payload;
  const users = await usersModel.findOne({email: "al@yopmail.com" }).lean(); 
  if(users?.fcmToken?.length===0){
    return errorResponseHandler("No FCM token found", httpStatusCode.BAD_REQUEST, res);
  }else{
    await sendNotification(users?.fcmToken || [], title, description);
  }
}
//**************For Testing**************/
