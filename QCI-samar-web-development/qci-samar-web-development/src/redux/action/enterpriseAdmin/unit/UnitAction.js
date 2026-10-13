import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../../services/api';
import { Logger } from '../../../../utils/logger';

// Get all units
export const getAllUnitsAction = createAsyncThunk('units', async (id, { rejectWithValue }) => {
  try {
    const response = await Api.Unit.getAllUnits(id);
    Logger.info('Get all units successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get all units failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// create new unit
export const createUnitAction = createAsyncThunk('createUnit', async (unitData, { rejectWithValue }) => {
  try {
    Logger.info('Create unit attempt:', { unitData });
    const response = await Api.Unit.createUnit(unitData);
    Logger.info('Create unit successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create unit failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// get units details
export const getUnitDetailsAction = createAsyncThunk('getUnitDetails', async (unitId, { rejectWithValue }) => {
  try {
    Logger.info('Get unit details attempt:', { unitId });
    const response = await Api.Unit.getUnitDetails(unitId);
    Logger.info('Get unit details successful:', response);
    return response.data;
  } catch (error) {
    Logger.error('Get unit details failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// update unit
export const updateUnitAction = createAsyncThunk('updateUnit', async ({ unitId, unitData }, { rejectWithValue }) => {
  try {
    Logger.info('Update unit attempt:', { unitId, unitData });
    const response = await Api.Unit.updateUnit(unitId, unitData);
    Logger.info('Update unit successful:', response);
    return response.data;
  } catch (error) {
    Logger.error('Update unit failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
