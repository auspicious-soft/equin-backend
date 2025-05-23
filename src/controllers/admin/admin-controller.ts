import { Request, Response } from "express";
import {
  // loginService,
  newPassswordAfterOTPVerifiedService,
  forgotPasswordService,
  // logoutService,
  getAdminDetailsService,
  sendPushNotificationServices,
} from "../../services/admin/admin-service";
import { errorParser } from "../../lib/errors/error-response-handler";
import { httpStatusCode } from "../../lib/constant";

export const login = async (req: Request, res: Response) => {
  try {
    console.log("req.body: ", req.body);
    // const response = await loginService(req.body, res);
    const response = {};
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const response = await forgotPasswordService(req.body.username, res);
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const newPassswordAfterOTPVerified = async (
  req: Request,
  res: Response
) => {
  try {
    const response = await newPassswordAfterOTPVerifiedService(req.body, res);
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};
export const getAdminDetails = async (req: Request, res: Response) => {
    try {
      const response = await getAdminDetailsService(req.body, res);
      return res.status(httpStatusCode.OK).json(response);
    } catch (error: any) {
      const { code, message } = errorParser(error);
      return res
        .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: message || "An error occurred" });
    }
  };

export const logoutEmployee = async (req: Request, res: Response) => {
  try {
    // const response = await logoutService(req.body, res);
    const response = {}
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};


export const sendPushNotificationToUser = async (req: Request, res: Response) => {
  try {
    const response = await sendPushNotificationServices(req.body, res);
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};