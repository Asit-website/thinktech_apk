// Attendance-based salary calculation utilities

// Calculate working days in a month
export const getWorkingDaysInMonth = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  let workingDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();
    
    // Exclude Sundays (0) and Saturdays (6) as weekly offs
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  
  return workingDays;
};

// Calculate payable days based on attendance
export const calculatePayableDays = (attendanceData) => {
  const { workingDays, presentDays, halfDays, fullDayLeaves, absentDays } = attendanceData;
  
  // Calculate payable days
  // Present days count as full days
  // Half days count as 0.5 days
  // Leaves and absents don't count as payable days
  const payableDays = presentDays + (halfDays * 0.5);
  
  // Calculate attendance percentage
  const attendancePercentage = workingDays > 0 ? (payableDays / workingDays) * 100 : 0;
  
  return {
    totalWorkingDays: workingDays,
    payableDays,
    attendancePercentage,
    presentDays,
    halfDays,
    fullDayLeaves,
    absentDays
  };
};

// Generate mock attendance data for testing (fallback only)
export const getMockAttendanceData = (year, month) => {
  const workingDays = getWorkingDaysInMonth(year, month);
  
  // Generate consistent mock data (no random values)
  const presentDays = Math.floor(workingDays * 0.85); // 85% attendance
  const halfDays = 1; // Fixed 1 half day
  const fullDayLeaves = 1; // Fixed 1 leave
  const absentDays = workingDays - presentDays - halfDays - fullDayLeaves;
  
  return {
    workingDays,
    presentDays,
    halfDays,
    fullDayLeaves,
    absentDays
  };
};

// Get real attendance data from API
export const getRealAttendanceData = async (year, month) => {
  try {
    const { getAttendanceData, processAttendanceData } = await import('../config/attendanceApi');
    
    const attendanceRecords = await getAttendanceData(year, month);
    
    if (attendanceRecords) {
      const processedData = processAttendanceData(attendanceRecords);
      
      // If no actual attendance data exists, return null
      if (!processedData) {
        return null;
      }
      
      return processedData;
    }
    
    // If no records at all, return null
    return null;
  } catch (error) {
    console.error('Error getting real attendance data:', error);
    // Don't fallback to mock data - return null to indicate no data
    return null;
  }
};

// Calculate salary based on attendance and template
export const calculateAttendanceBasedSalary = (baseSalaryData, attendanceData, salaryTemplate = null) => {
  if (!baseSalaryData || !attendanceData) return baseSalaryData;
  
  const attendanceInfo = calculatePayableDays(attendanceData);
  const attendanceFactor = attendanceInfo.payableDays / attendanceInfo.totalWorkingDays;
  
  // Start with base salary data (keep all original values)
  let calculatedSalary = {
    ...baseSalaryData,
    attendanceInfo,
    attendanceBased: true
  };
  
  // If template is provided, use template fields for calculations
  if (salaryTemplate) {
    // Parse template fields from JSON if needed
    const earnings = typeof salaryTemplate.earnings === 'string' 
      ? JSON.parse(salaryTemplate.earnings) 
      : (salaryTemplate.earnings || {});
    
    const incentives = typeof salaryTemplate.incentives === 'string' 
      ? JSON.parse(salaryTemplate.incentives) 
      : (salaryTemplate.incentives || {});
    
    const deductions = typeof salaryTemplate.deductions === 'string' 
      ? JSON.parse(salaryTemplate.deductions) 
      : (salaryTemplate.deductions || {});
    
    // Convert array format to object format for easier processing
    const earningsObj = {};
    const incentivesObj = {};
    const deductionsObj = {};
    
    // Process earnings from template
    if (Array.isArray(earnings)) {
      earnings.forEach(item => {
        earningsObj[item.key] = item;
      });
    } else {
      Object.assign(earningsObj, earnings);
    }
    
    // Process incentives from template
    if (Array.isArray(incentives)) {
      incentives.forEach(item => {
        incentivesObj[item.key] = item;
      });
    } else {
      Object.assign(incentivesObj, incentives);
    }
    
    // Process deductions from template
    if (Array.isArray(deductions)) {
      deductions.forEach(item => {
        deductionsObj[item.key] = item;
      });
    } else {
      Object.assign(deductionsObj, deductions);
    }
    
    // Keep original earnings values (fixed per month)
    const calculatedEarnings = {};
    
    // Store original earnings values (not affected by attendance)
    Object.keys(earningsObj).forEach(field => {
      const fieldConfig = earningsObj[field];
      const baseValue = parseFloat(baseSalaryData[field] || fieldConfig.valueNumber || 0);
      calculatedEarnings[field] = baseValue.toFixed(2);
      calculatedEarnings[field + '_adjusted'] = (baseValue * attendanceFactor).toFixed(2);
    });
    
    // Keep original incentives values (fixed per month)
    const calculatedIncentives = {};
    
    Object.keys(incentivesObj).forEach(field => {
      const fieldConfig = incentivesObj[field];
      const baseValue = parseFloat(baseSalaryData[field] || fieldConfig.valueNumber || 0);
      calculatedIncentives[field] = baseValue.toFixed(2);
    });
    
    // Keep original deductions values (fixed per month)
    const calculatedDeductions = {};
    
    Object.keys(deductionsObj).forEach(field => {
      const fieldConfig = deductionsObj[field];
      const baseValue = parseFloat(baseSalaryData[field] || fieldConfig.valueNumber || 0);
      calculatedDeductions[field] = baseValue.toFixed(2);
    });
    
    // Calculate totals using adjusted earnings (attendance-based)
    const totalEarnings = Object.keys(calculatedEarnings)
      .filter(key => !key.endsWith('_adjusted'))
      .reduce((sum, key) => sum + parseFloat(calculatedEarnings[key]), 0);
    const totalEarningsAdjusted = Object.keys(calculatedEarnings)
      .filter(key => key.endsWith('_adjusted'))
      .reduce((sum, key) => sum + parseFloat(calculatedEarnings[key]), 0);
    const totalIncentives = Object.values(calculatedIncentives).reduce((sum, val) => sum + parseFloat(val), 0);
    const totalDeductions = Object.values(calculatedDeductions).reduce((sum, val) => sum + parseFloat(val), 0);
    
    const grossSalary = totalEarningsAdjusted + totalIncentives;
    const netSalary = grossSalary - totalDeductions;
    
    calculatedSalary = {
      ...calculatedSalary,
      ...calculatedEarnings,
      ...calculatedIncentives,
      ...calculatedDeductions,
      totalEarnings: totalEarnings.toFixed(2), // Original total
      totalEarningsAdjusted: totalEarningsAdjusted.toFixed(2), // Attendance-adjusted total
      totalIncentives: totalIncentives.toFixed(2),
      totalDeductions: totalDeductions.toFixed(2),
      grossSalary: grossSalary.toFixed(2),
      netSalary: netSalary.toFixed(2),
      templateFields: {
        earnings: earningsObj,
        incentives: incentivesObj,
        deductions: deductionsObj
      }
    };
  } else {
    // Fallback to default fields if no template
    const earningsComponents = {
      basicSalary: parseFloat(baseSalaryData.basicSalary || 0).toFixed(2),
      hra: parseFloat(baseSalaryData.hra || 0).toFixed(2),
      da: parseFloat(baseSalaryData.da || 0).toFixed(2),
      specialAllowance: parseFloat(baseSalaryData.specialAllowance || 0).toFixed(2),
      conveyanceAllowance: parseFloat(baseSalaryData.conveyanceAllowance || 0).toFixed(2),
      medicalAllowance: parseFloat(baseSalaryData.medicalAllowance || 0).toFixed(2),
      telephoneAllowance: parseFloat(baseSalaryData.telephoneAllowance || 0).toFixed(2),
      otherAllowances: parseFloat(baseSalaryData.otherAllowances || 0).toFixed(2),
    };
    
    // Store adjusted values for calculation
    const adjustedEarnings = {};
    Object.keys(earningsComponents).forEach(field => {
      const baseValue = parseFloat(earningsComponents[field]);
      adjustedEarnings[field + '_adjusted'] = (baseValue * attendanceFactor).toFixed(2);
    });
    
    // Calculate total earnings
    const totalEarnings = Object.values(earningsComponents).reduce((sum, val) => sum + parseFloat(val), 0);
    const totalEarningsAdjusted = Object.values(adjustedEarnings).reduce((sum, val) => sum + parseFloat(val), 0);
    
    // Deductions remain fixed
    const totalDeductions = parseFloat(baseSalaryData.totalDeductions || 0);
    
    // Calculate gross and net salary using adjusted earnings
    const grossSalary = totalEarningsAdjusted;
    const netSalary = totalEarningsAdjusted - totalDeductions;
    
    calculatedSalary = {
      ...calculatedSalary,
      ...earningsComponents,
      ...adjustedEarnings,
      totalEarnings: totalEarnings.toFixed(2), // Original total
      totalEarningsAdjusted: totalEarningsAdjusted.toFixed(2), // Attendance-adjusted total
      grossSalary: grossSalary.toFixed(2),
      netSalary: netSalary.toFixed(2),
      templateFields: {
        earnings: Object.keys(earningsComponents),
        incentives: [],
        deductions: ['pfDeduction', 'esiDeduction', 'professionalTax', 'tdsDeduction', 'otherDeductions']
      }
    };
  }
  
  return calculatedSalary;
};
