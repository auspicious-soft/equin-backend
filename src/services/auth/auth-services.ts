import { Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { httpStatusCode } from "src/lib/constant";
import { errorResponseHandler } from "src/lib/errors/error-response-handler";
import { pricePlanModel } from "src/models/admin/price-plan-schema";
import { questionResponseModel } from "src/models/admin/question-response-schema";
import { questionModel } from "src/models/admin/questions-schema";
import { userPlanModel } from "src/models/user-plan/user-plan-schema";
import { UserDocument, usersModel } from "src/models/user/user-schema";
import { sendEmailVerificationMail, sendPasswordResetEmail } from "src/utils/mails/mail";
import {
  generateUserToken,
  getSignUpQueryByAuthType,
  handleExistingUser,
  hashPasswordIfEmailAuth,
  sendOTPIfNeeded,
  validatePassword,
  validateUserForLogin,
} from "src/utils/userAuth/signUpAuth";
import { configDotenv } from "dotenv";
import {
  generatePasswordResetToken,
  getPasswordResetTokenByToken,
} from "src/utils/mails/token";
import { passwordResetTokenModel } from "src/models/password-token-schema";
import { generateOtpWithTwilio } from "src/utils/sms/sms";
import { mealPlanModel } from "src/models/admin/meal-plan-schema";
import { essentialTipModel } from "src/models/admin/essential-tips-schema";
configDotenv();

const sanitizeUser = (user: any): UserDocument => {
  const sanitized = user.toObject();
  delete sanitized.password;
  delete sanitized.otp;
  return sanitized;
};

//************************* META DATA *************************/

export const createQuestionsServices = async (payload: any, res: Response) => {
  // const result = await questionModel.insertMany(payload.questions);
  return {
    success: true,
    message: "Questions created successfully",
  };
};
export const createPlanServices = async (payload: any, res: Response) => {
  // const result = await pricePlanModel.insertMany(payload.plans);
  return {
    success: true,
    message: "Pricing plans created successfully",
  };
};
export const createMealPlanServices = async (payload: any, res: Response) => {
  console.log("payload", payload);
  // const result = await mealPlanModel.insertMany(payload.plans);
  return {
    success: true,
    message: "Meal plans created successfully",
  };
};
export const createEssentialTipsServices = async (payload: any, res: Response) => {
  console.log("payload", payload);
  // const result = await essentialTipModel.create(payload);
  return {
    success: true,
    message: "New tip added successfully",
  };
};

//************************* USER QUESTIONAIRE *************************/

export const getQuestionsServices = async (payload: any, res: Response) => {
  const { deviceId } = payload;
  const result = await questionModel.find().sort({ order: 1 });
  const questionResponse = await questionResponseModel.find({ deviceId });
  return {
    success: true,
    message: "Questions retrieved successfully",
    data: {
      questions: result,
      questionResponse,
    },
  };
};
export const getPlanServices = async (payload: any, res: Response) => {
  const result = await pricePlanModel.find();
  return {
    success: true,
    message: "Plans created successfully",
    data: result,
  };
};
export const saveAnswerServices = async (payload: any, res: Response) => {
  const { deviceId, questionId, selectedOptionValues, order } = payload;

  if (!deviceId || !questionId || !selectedOptionValues) {
    return errorResponseHandler(
      "Invalid payload",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await questionResponseModel
      .deleteOne({ deviceId, questionId })
      .session(session);

    await questionResponseModel.create(
      [
        {
          deviceId,
          questionId,
          selectedOptionValues,
          order,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const responseResult = await questionResponseModel.find({ deviceId });

    return {
      success: true,
      message: "Answer saved successfully",
      data: responseResult,
    };
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    return errorResponseHandler(
      (error.message as any) ||
        "Failed to save answer" ||
        "Failed to save answer",
      httpStatusCode.INTERNAL_SERVER_ERROR,
      res
    );
  }
};

//************************* USER SIGNUP *************************/

export const userSignUpServices = async (payload: any, res: Response) => {
  const { authType, ...userData } = payload;
  if (!authType) {
    return errorResponseHandler(
      "Auth type is required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  const query = getSignUpQueryByAuthType(userData, authType);
  const existingUser = await usersModel.findOne(query);
  const existingUserResponse = existingUser
    ? handleExistingUser(existingUser as any, authType, res)
    : null;
  if (existingUserResponse) return existingUserResponse;

  const newUserData = { ...userData, authType };
  newUserData.password = await hashPasswordIfEmailAuth(userData, authType);
  const user = await usersModel.create(newUserData);
  await sendOTPIfNeeded(userData, authType);

  if (!process.env.AUTH_SECRET) {
    return errorResponseHandler(
      "AUTH_SECRET is not defined",
      httpStatusCode.INTERNAL_SERVER_ERROR,
      res
    );
  }
  await user.save();
  return {
    success: true,
    message: "OTP sent for verification",
  };
};

export const verifyOTPServices = async (payload: any) => {
  const { email, otp } = payload;
  const user = await usersModel.findOne({
    email,
    "otp.code": otp,
    "otp.expiresAt": { $gt: new Date() },
  });

  if (!user) {
    throw new Error("Invalid or expired OTP");
  }

  if (user.otp) {
    user.otp.code = "";
    user.otp.expiresAt = new Date(0);
  }
  if (email) {
    user.emailVerified = true;
  }
  user.token = generateUserToken(user as any);

  await questionResponseModel.updateMany(
    { deviceId: user?.deviceId, userId: null },
    { $set: { userId: user?._id } },
    { multi: true }
  );

  await userPlanModel.updateOne(
    { deviceId: user?.deviceId, userId: null },
    { $set: { userId: user?._id } }
  );

  await user.save();
  return { data: sanitizeUser(user), message: "OTP verified successfully" };
};

export const forgotPasswordUserService = async (
  payload: any,
  res: Response
) => {
  const { email } = payload;
  console.log("email: ", email);
  const user = await usersModel.findOne({ email }).select("+password");
  if (!user)
    return errorResponseHandler(
      "Email not found",
      httpStatusCode.NOT_FOUND,
      res
    );
  if (user.authType !== "Email")
    return errorResponseHandler(
      `Try login using ${user.authType}`,
      httpStatusCode.BAD_REQUEST,
      res
    );
  const passwordResetToken = await generatePasswordResetToken(email);

  if (passwordResetToken !== null) {
    await sendPasswordResetEmail(
      email,
      passwordResetToken.token,
      user.language
    );
    return { success: true, message: "Password reset email sent with otp" };
  }
};

export const verifyOtpPasswordResetService = async (
  token: string,
  res: Response
) => {
  console.log("token: ", token);
  const existingToken = await getPasswordResetTokenByToken(token);
  if (!existingToken)
    return errorResponseHandler(
      "Invalid token",
      httpStatusCode.BAD_REQUEST,
      res
    );

  const hasExpired = new Date(existingToken.expires) < new Date();
  if (hasExpired)
    return errorResponseHandler("OTP expired", httpStatusCode.BAD_REQUEST, res);
  return { success: true, message: "Token verified successfully" };
};

export const updateForgottenPasswordService = async (
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

  let existingUser: any;

  if (existingToken.email) {
    existingUser = await usersModel.findOne({
      email: existingToken.email,
      authType: "Email",
    });
  } else if (existingToken.phoneNumber) {
    existingUser = await usersModel.findOne({
      phoneNumber: existingToken.phoneNumber,
    });
  }
  if (!existingUser) {
    return errorResponseHandler(
      `Please try login with ${existingUser.authType}`,
      httpStatusCode.BAD_REQUEST,
      res
    );
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const response = await usersModel.findByIdAndUpdate(
    existingUser._id,
    { password: hashedPassword },
    { new: true }
  );
  await passwordResetTokenModel.findByIdAndDelete(existingToken._id);

  return {
    success: true,
    message: "Password updated successfully",
    data: sanitizeUser(response),
  };
};

const createNewUser = async (userData: any, authType: string) => {
  let newUser = new usersModel({
    email: userData.email,
    lastName: userData.lastName,
    firstName: userData.firstName,
    authType: authType,
    fcmToken: userData.fcmToken,
    profilePic: userData.profilePic,
    password: null,
    token: generateUserToken(userData),
  });

  await newUser.save();

  return newUser;
};

export const userSignInServices = async (
  userData: UserDocument,
  authType: string,
  res: Response
) => {
  let query = getSignUpQueryByAuthType(userData, authType);

  let user: any = await usersModel.findOne(query);

  if (
    !user &&
    (authType === "Google" || authType === "Apple" || authType === "Facebook")
  ) {
    user = await createNewUser(userData, authType);
  }

  let validationResponse = await validateUserForLogin(
    user,
    authType,
    userData,
    res
  );
  if (validationResponse) return validationResponse;

  if (authType === "Email") {
    let passwordValidationResponse = await validatePassword(
      userData,
      user.password,
      res
    );
    if (passwordValidationResponse) return passwordValidationResponse;
  }

  user.token = generateUserToken(user as any);

  await user.save();
  return {
    success: true,
    message: "Logged in successfully",
    data: sanitizeUser(user),
  };
};

export const generateAndSendOTP = async (payload: { email?: string; phoneNumber?: string }) => {
    const { email, phoneNumber } = payload;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // OTP expires in 20 minutes

    let user;
    if (email) {
      user = await usersModel.findOneAndUpdate(
        { email },
        {
          $set: {
            "otp.code": otp,
            "otp.expiresAt": expiresAt,
          },
        },
        { upsert: true, new: true }
      );
    } else if (phoneNumber) {
      user = await usersModel.findOneAndUpdate(
        { phoneNumber },
        {
          $set: {
            "otp.code": otp,
            "otp.expiresAt": expiresAt,
          },
        },
        { upsert: true, new: true }
      );
    }


    if (user) {
      // No need to call save if findOneAndUpdate handles the commit
      console.log('OTP successfully generated and saved for user: ', user);
    }

    // Send OTP via the respective method
    if (phoneNumber) {
      await generateOtpWithTwilio(phoneNumber, otp);
    }
    if (email) {
      await sendEmailVerificationMail(email, otp, user?.language || "english");
    }
    return { success: true, message: "OTP sent successfully" };
  } 
