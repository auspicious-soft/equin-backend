import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { myPlanService } from '../../../src/services/user/user-service';
import { trackUserMealModel } from '../../../src/models/user/track-user-meal';
import { userPlanModel } from '../../../src/models/user-plan/user-plan-schema';
import { mealPlanModel30 } from '../../../src/models/admin/30days-meal-plan-schema';
import { essentialTipModel } from '../../../src/models/admin/essential-tips-schema';
import { pricePlanModel } from '../../../src/models/admin/price-plan-schema';
import * as dateUtils from '../../../src/utils/date-utils';

// Mock dependencies
jest.mock('../../../src/models/user/track-user-meal');
jest.mock('../../../src/models/user-plan/user-plan-schema');
jest.mock('../../../src/models/admin/30days-meal-plan-schema');
jest.mock('../../../src/models/admin/essential-tips-schema');
jest.mock('../../../src/models/admin/price-plan-schema');
jest.mock('../../../src/utils/date-utils');

describe('myPlanService - duplicate records test', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockUserId: mongoose.Types.ObjectId;
  
  beforeEach(() => {
    mockUserId = new mongoose.Types.ObjectId();
    mockRequest = {
      user: { id: mockUserId.toString(), gender: 'Male' }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock date utilities
    const mockToday = new Date('2023-01-01T00:00:00Z');
    const mockTomorrow = new Date('2023-01-02T00:00:00Z');
    (dateUtils.getTodayUTC as jest.Mock).mockReturnValue(mockToday);
    (dateUtils.getTomorrowUTC as jest.Mock).mockReturnValue(mockTomorrow);
    (dateUtils.getDateMidnightUTC as jest.Mock).mockImplementation(date => {
      const newDate = new Date(date);
      newDate.setUTCHours(0, 0, 0, 0);
      return newDate;
    });
  });

  test('should not create duplicate meal records for the same day', async () => {
    // Mock active plan
    const mockPlanId = new mongoose.Types.ObjectId();
    const mockStartDate = new Date('2022-12-25T00:00:00Z');
    const mockEndDate = new Date('2023-01-25T00:00:00Z');
    
    (userPlanModel.findOne as jest.Mock).mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          planId: { _id: mockPlanId },
          startDate: mockStartDate,
          endDate: mockEndDate
        })
      })
    });
    
    // Mock essential tips
    (essentialTipModel.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    });
    
    // Mock existing records - simulate a record for day 1
    const existingRecord = {
      _id: new mongoose.Types.ObjectId(),
      userId: mockUserId,
      planId: new mongoose.Types.ObjectId(),
      planDay: new Date('2023-01-01T00:00:00Z'),
      toObject: () => ({
        _id: existingRecord._id,
        userId: existingRecord.userId,
        planId: existingRecord.planId,
        planDay: existingRecord.planDay
      })
    };
    
    // Return the existing record when queried
    (trackUserMealModel.find as jest.Mock).mockResolvedValue([existingRecord]);
    
    // Mock meal plans
    const mockMealPlan = {
      _id: new mongoose.Types.ObjectId(),
      day: 1,
      plan_type: 'Men'
    };
    (mealPlanModel30.find as jest.Mock).mockResolvedValue([mockMealPlan]);
    
    // Mock bulkWrite and insertMany to track calls
    (trackUserMealModel.bulkWrite as jest.Mock).mockResolvedValue({});
    (trackUserMealModel.insertMany as jest.Mock).mockResolvedValue([]);
    
    // Mock the 7-day meal tracker query
    (trackUserMealModel.find as jest.Mock)
      .mockResolvedValueOnce([existingRecord]) // First call for existing records
      .mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([])
        })
      }); // Second call for 7-day tracker
    
    // Execute the service
    await myPlanService(mockRequest as Request, mockResponse as Response);
    
    // Check if bulkWrite was called with the correct operations
    // It should not try to update the existing record if planId matches
    const bulkWriteCalls = (trackUserMealModel.bulkWrite as jest.Mock).mock.calls;
    expect(bulkWriteCalls.length).toBe(0);
    
    // Check if insertMany was called with the correct entries
    // It should not try to insert a new record for a date that already has one
    const insertManyCalls = (trackUserMealModel.insertMany as jest.Mock).mock.calls;
    
    // Log the calls for debugging
    console.log('Insert many calls:', JSON.stringify(insertManyCalls, null, 2));
    
    // Verify no duplicate entries for the same date
    if (insertManyCalls.length > 0) {
      const insertedDates = insertManyCalls[0][0].map((entry: any) => 
        entry.planDay.toISOString().split('T')[0]
      );
      
      // Check for duplicates in the dates
      const uniqueDates = new Set(insertedDates);
      expect(uniqueDates.size).toBe(insertedDates.length);
      
      // Ensure we're not inserting for dates that already have records
      const existingDate = existingRecord.planDay.toISOString().split('T')[0];
      expect(insertedDates).not.toContain(existingDate);
    }
  });
});