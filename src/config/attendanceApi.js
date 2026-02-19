import { getMe } from './api';

// Get attendance data for a specific month and year
export const getAttendanceData = async (year, month) => {
  try {
    const userResponse = await getMe();
    const userId = userResponse.data.id;
    
    // Format month and year for API
    const monthString = String(month + 1).padStart(2, '0'); // Convert 0-11 to 1-12
    const yearString = String(year);
    
    const response = await fetch(`/api/attendance/user/${userId}?year=${yearString}&month=${monthString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch attendance data');
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      return data.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching attendance data:', error);
    return null;
  }
};

// Process attendance data to calculate attendance summary
export const processAttendanceData = (attendanceRecords) => {
  if (!attendanceRecords || attendanceRecords.length === 0) {
    return null;
  }
  
  let workingDays = 0;
  let presentDays = 0;
  let halfDays = 0;
  let fullDayLeaves = 0;
  let absentDays = 0;
  let holidays = 0;
  let weeklyOffs = 0;
  let hasActualData = false;
  
  attendanceRecords.forEach(record => {
    // Don't count holidays and weekly offs as working days
    if (record.status === 'holiday') {
      holidays++;
      return;
    }
    
    if (record.status === 'weekly_off') {
      weeklyOffs++;
      return;
    }
    
    // Count as working day
    workingDays++;
    
    // Check if we have actual attendance data (check-in/check-out)
    if (record.checkIn || record.checkOut) {
      hasActualData = true;
    }
    
    switch (record.status) {
      case 'present':
        presentDays++;
        break;
      case 'half_day':
        halfDays++;
        break;
      case 'leave':
        fullDayLeaves++;
        break;
      case 'absent':
        absentDays++;
        break;
      default:
        // Unknown status, count as absent
        absentDays++;
        break;
    }
  });
  
  // If no actual attendance data exists, return null to indicate no data
  if (!hasActualData && presentDays === 0 && halfDays === 0) {
    return null;
  }
  
  return {
    workingDays,
    presentDays,
    halfDays,
    fullDayLeaves,
    absentDays,
    holidays,
    weeklyOffs,
    totalDays: attendanceRecords.length,
    hasActualData
  };
};
