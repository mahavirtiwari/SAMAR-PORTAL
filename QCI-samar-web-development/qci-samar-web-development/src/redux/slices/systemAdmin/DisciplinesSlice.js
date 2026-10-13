import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  activateDisciplineAction,
  createDisciplineAction,
  deactivateDisciplineAction,
  deleteDisciplineAction,
  getDisciplineByIdAction,
  getDisciplinesAction,
  updateDisciplineAction,
} from '../../action/systemAdmin/DisciplinesAction';

const initialState = {
  disciplines: [],
  disciplinesLoading: false,
  disciplinesError: null,

  discipline: null,
  disciplineLoading: false,
  disciplineError: null,

  createLoading: false,
  createError: null,
  createdDiscipline: null,

  updateLoading: false,
  updateError: null,
  updatedDiscipline: null,

  deleteLoading: false,
  deleteError: null,
  deletedDiscipline: null,

  activateLoading: false,
  activateError: null,
  activatedDiscipline: null,

  deactivateLoading: false,
  deactivateError: null,
  deactivatedDiscipline: null,
};

const disciplinesSlice = createSlice({
  name: 'disciplines',
  initialState,
  reducers: {
    resetDisciplinesCreateUpdateDelete(state) {
      state.createLoading = false;
      state.createError = null;
      state.createdDiscipline = null;
      state.updateLoading = false;
      state.updateError = null;
      state.updatedDiscipline = null;
      state.deleteLoading = false;
      state.deleteError = null;
      state.deletedDiscipline = null;
      state.activateLoading = false;
      state.activateError = null;
      state.activatedDiscipline = null;
      state.deactivateLoading = false;
      state.deactivateError = null;
      state.deactivatedDiscipline = null;
    },
  },
  extraReducers: builder => {
    builder
      // Get all disciplines
      .addCase(getDisciplinesAction.pending, state => {
        state.disciplinesLoading = true;
        state.disciplinesError = null;
      })
      .addCase(getDisciplinesAction.fulfilled, (state, action) => {
        state.disciplinesLoading = false;
        state.disciplines = action.payload || [];
        Logger.info('Disciplines loaded successfully in slice');
      })
      .addCase(getDisciplinesAction.rejected, (state, action) => {
        state.disciplinesLoading = false;
        state.disciplinesError = action.payload;
        Logger.error('Get disciplines failed in slice:', action.payload);
      })

      // Get discipline by ID
      .addCase(getDisciplineByIdAction.pending, state => {
        state.disciplineLoading = true;
        state.disciplineError = null;
      })
      .addCase(getDisciplineByIdAction.fulfilled, (state, action) => {
        state.disciplineLoading = false;
        state.discipline = action.payload || null;
        Logger.info('Discipline loaded successfully in slice');
      })
      .addCase(getDisciplineByIdAction.rejected, (state, action) => {
        state.disciplineLoading = false;
        state.disciplineError = action.payload;
        Logger.error('Get discipline failed in slice:', action.payload);
      })

      // Create discipline
      .addCase(createDisciplineAction.pending, state => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createDisciplineAction.fulfilled, (state, action) => {
        state.createLoading = false;
        state.createdDiscipline = action.payload || null;
        Logger.info('Discipline created successfully in slice');
      })
      .addCase(createDisciplineAction.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
        Logger.error('Create discipline failed in slice:', action.payload);
      })

      // Update discipline
      .addCase(updateDisciplineAction.pending, state => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateDisciplineAction.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.updatedDiscipline = action.payload || null;
        Logger.info('Discipline updated successfully in slice');
      })
      .addCase(updateDisciplineAction.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
        Logger.error('Update discipline failed in slice:', action.payload);
      })

      // Delete discipline
      .addCase(deleteDisciplineAction.pending, state => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deleteDisciplineAction.fulfilled, (state, action) => {
        state.deleteLoading = false;
        state.deletedDiscipline = action.payload || null;
        Logger.info('Discipline deleted successfully in slice');
      })
      .addCase(deleteDisciplineAction.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload;
        Logger.error('Delete discipline failed in slice:', action.payload);
      })

      // Activate discipline
      .addCase(activateDisciplineAction.pending, state => {
        state.activateLoading = true;
        state.activateError = null;
      })
      .addCase(activateDisciplineAction.fulfilled, (state, action) => {
        state.activateLoading = false;
        state.activatedDiscipline = action.payload || null;
        Logger.info('Discipline activated successfully in slice');
      })
      .addCase(activateDisciplineAction.rejected, (state, action) => {
        state.activateLoading = false;
        state.activateError = action.payload;
        Logger.error('Activate discipline failed in slice:', action.payload);
      })

      // Deactivate discipline
      .addCase(deactivateDisciplineAction.pending, state => {
        state.deactivateLoading = true;
        state.deactivateError = null;
      })
      .addCase(deactivateDisciplineAction.fulfilled, (state, action) => {
        state.deactivateLoading = false;
        state.deactivatedDiscipline = action.payload || null;
        Logger.info('Discipline deactivated successfully in slice');
      })
      .addCase(deactivateDisciplineAction.rejected, (state, action) => {
        state.deactivateLoading = false;
        state.deactivateError = action.payload;
        Logger.error('Deactivate discipline failed in slice:', action.payload);
      });
  },
});

export const { resetDisciplinesCreateUpdateDelete } = disciplinesSlice.actions;
export default disciplinesSlice.reducer;
