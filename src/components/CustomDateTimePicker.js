import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import CustomDatePicker from './CustomDatePicker';
import CustomTimePicker from './CustomTimePicker';

const CustomDateTimePicker = ({ visible, onClose, onSelect, initialDate }) => {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [showDatePicker, setShowDatePicker] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleDateSelect = (date) => {
    setCurrentDate(date);
    setShowDatePicker(false);
    setShowTimePicker(true);
  };

  const handleTimeSelect = (time) => {
    const finalDate = new Date(currentDate);
    finalDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
    onSelect(finalDate);
    onClose();
  };

  const handleClose = () => {
    setShowDatePicker(true);
    setShowTimePicker(false);
    onClose();
  };

  return (
    <>
      <CustomDatePicker
        visible={visible && showDatePicker}
        onClose={handleClose}
        onSelect={handleDateSelect}
        initialDate={currentDate}
      />
      <CustomTimePicker
        visible={visible && showTimePicker}
        onClose={handleClose}
        onSelect={handleTimeSelect}
        initialTime={currentDate}
      />
    </>
  );
};

export default CustomDateTimePicker;
