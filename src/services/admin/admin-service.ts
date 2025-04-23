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
import {
  EmployeeDocument,
  employeesModel,
} from "src/models/employees/employee-schema";
import { attendanceModel } from "src/models/attendance/attendance-schema";
const sanitizeUser = (user: any): EmployeeDocument => {
  const sanitized = user.toObject();
  delete sanitized.password;
  delete sanitized.otp;
  return sanitized;
};

export const loginService = async (payload: any, res: Response) => {
  const { email, password } = payload;
  console.log("email: ", email);
  const countryCode = "+45";
  const toNumber = Number(email);
  const isEmail = isNaN(toNumber);
  let user: any = null;

  if (isEmail) {
    console.log("isEmail: ", isEmail);
    const checkAdmin = await adminModel
      .findOne({ email: email })
      .select("+password");
    const checkEmployee = await employeesModel
      .findOne({ email: email })
      .select("+password");
    user = checkAdmin || checkEmployee;
    console.log("user: ", user);
  }

  if (!user)
    return errorResponseHandler(
      "User not found",
      httpStatusCode.NOT_FOUND,
      res
    );
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return errorResponseHandler(
      "Invalid password",
      httpStatusCode.UNAUTHORIZED,
      res
    );
  }
  const userObject = user.toObject();
  delete userObject.password;

  if (user.role === "employee") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await attendanceModel.findOne({
      employeeId: user._id,
      date: today,
    });

    if (!existingAttendance) {
      await attendanceModel.create({
        employeeId: user._id,
        date: today,
        status: "Present",
        checkInTime: new Date(),
      });
    }
  }

  return {
    success: true,
    message: "Login successful",
    data: {
      user: userObject,
    },
  };
};
export const logoutService = async (payload: any, res: Response) => {
  const { id: employeeId } = payload;

  if (!employeeId) {
    return errorResponseHandler(
      "Employee ID is required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of the day

  // Find today's attendance record
  const attendanceRecord = await attendanceModel.findOne({
    employeeId,
    date: today,
  });

  if (!attendanceRecord) {
    return errorResponseHandler(
      "No attendance record found for today",
      httpStatusCode.NOT_FOUND,
      res
    );
  }

  if (attendanceRecord.checkOutTime) {
    return errorResponseHandler(
      "Employee has already checked out",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }
  attendanceRecord.checkOutTime = new Date();
  await attendanceRecord.save();

  return {
    success: true,
    message: "Logout successful, check-out time recorded",
    data: { checkOutTime: attendanceRecord.checkOutTime },
  };
};
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

