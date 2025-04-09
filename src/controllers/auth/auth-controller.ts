import { Request, Response } from "express";
import { httpStatusCode } from "../../lib/constant";
import { errorParser } from "../../lib/errors/error-response-handler";
import {
  createPlanServices,
  createQuestionsServices,
  forgotPasswordUserService,
  getPlanServices,
  getQuestionsServices,
  saveAnswerServices,
  savePricePlanServices,
  updateForgottenPasswordService,
  userSignInServices,
  userSignUpServices,
  verifyOtpPasswordResetService,
  verifyOTPServices,
} from "src/services/auth/auth-services";
import { verifyOTPService } from "src/services/user/user-service";

//************************* META DATA *************************/

export const createQuestions = async (req: Request, res: Response) => {
  try {
    const response = await createQuestionsServices(req.body, res);
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};
export const createPricePlan = async (req: Request, res: Response) => {
  try {
    const response = await createPlanServices(req.body, res);
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

//************************* USER QUESTIONAIRE *************************/

export const getQuestions = async (req: Request, res: Response) => {
  try {
    const response = await getQuestionsServices(req.body, res);
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const saveAnswers = async (req: Request, res: Response) => {
  try {
    const response = await saveAnswerServices(req.body, res);
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const getPricePlan = async (req: Request, res: Response) => {
  try {
    const response = await getPlanServices(req.body, res);
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const savePricePlan = async (req: Request, res: Response) => {
  try {
    const response = await savePricePlanServices(req.body, res);
    return res.status(httpStatusCode.OK).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

//************************* USER SIGNUP *************************/

export const userSignUp = async (req: Request, res: Response) => {
  try {
    const response = await userSignUpServices(req.body, res);
    return res.status(httpStatusCode.CREATED).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {

  try {
    const response = await verifyOTPServices(req.body);
    return res.status(httpStatusCode.CREATED).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const response = await forgotPasswordUserService(req.body, res);
    return res.status(httpStatusCode.CREATED).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};
export const verifyForgotPassOTP = async (req: Request, res: Response) => {
  try {
    const response = await verifyOtpPasswordResetService(req.body.token, res);
    return res.status(httpStatusCode.CREATED).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const updateForgottenPassword = async (req: Request, res: Response) => {
  try {
    const response = await updateForgottenPasswordService(req.body, res);
    return res.status(httpStatusCode.CREATED).json(response);
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const userSignIn = async (req: Request, res: Response) => {
    try {
      const response = await userSignInServices(req.body, req.body.authType, res);
      return res.status(httpStatusCode.CREATED).json(response);
    } catch (error: any) {
      const { code, message } = errorParser(error);
      return res
        .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: message || "An error occurred" });
    }
  };


