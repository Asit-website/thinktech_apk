import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';

const CustomDatePicker = ({ visible, onClose, onSelect, initialDate }) => {
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getDaysArray = (year, month) => {
    const days = [];
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = daysInMonth(year, month);

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= totalDays; day++) {
      days.push(day);
    }

    return days;
  };

  const handleDateSelect = (day) => {
    if (!day) return;

    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    setSelectedDate(newDate);
  };

  const changeMonth = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedDate(newDate);
  };

  const changeYear = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(newDate.getFullYear() + direction);
    setSelectedDate(newDate);
  };

  const handleDone = () => {
    onSelect(selectedDate);
    onClose();
  };

  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth();
  const days = getDaysArray(currentYear, currentMonth);
  const today = new Date();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
      }}>
        <View style={{
          backgroundColor: 'white',
          borderRadius: 12,
          width: '100%',
          maxWidth: 400,
          maxHeight: '80%'
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB'
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#111827',
              fontFamily: 'Inter_600SemiBold'
            }}>
              Select Date
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 24, color: '#6B7280' }}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Year and Month Navigation */}
          <View style={{
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB'
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12
            }}>
              <TouchableOpacity
                onPress={() => changeYear(-1)}
                style={{
                  padding: 8,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 6
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>«</Text>
              </TouchableOpacity>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#111827',
                fontFamily: 'Inter_600SemiBold'
              }}>
                {currentYear}
              </Text>
              <TouchableOpacity
                onPress={() => changeYear(1)}
                style={{
                  padding: 8,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 6
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>»</Text>
              </TouchableOpacity>
            </View>

            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <TouchableOpacity
                onPress={() => changeMonth(-1)}
                style={{
                  padding: 8,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 6
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>‹</Text>
              </TouchableOpacity>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#111827',
                fontFamily: 'Inter_600SemiBold'
              }}>
                {months[currentMonth]}
              </Text>
              <TouchableOpacity
                onPress={() => changeMonth(1)}
                style={{
                  padding: 8,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 6
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Days of Week Header */}
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB'
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <View key={day} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: '#6B7280',
                  fontFamily: 'Inter_600SemiBold'
                }}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <ScrollView style={{ maxHeight: 300 }}>
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              padding: 16
            }}>
              {days.map((day, index) => {
                const isSelected = day &&
                  selectedDate.getDate() === day &&
                  selectedDate.getMonth() === currentMonth &&
                  selectedDate.getFullYear() === currentYear;

                const isToday = day &&
                  today.getDate() === day &&
                  today.getMonth() === currentMonth &&
                  today.getFullYear() === currentYear;

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleDateSelect(day)}
                    disabled={!day}
                    style={{
                      width: '14.28%',
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: 1,
                      borderRadius: 8,
                      backgroundColor: isSelected ? '#125EC9' : 'transparent'
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      color: !day ? 'transparent' :
                             isSelected ? 'white' :
                             isToday ? '#125EC9' : '#111827',
                      fontWeight: isSelected || isToday ? '600' : '400',
                      fontFamily: isSelected || isToday ? 'Inter_600SemiBold' : 'Inter_400Regular'
                    }}>
                      {day || ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB'
          }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 20,
                backgroundColor: '#F3F4F6',
                borderRadius: 8
              }}
            >
              <Text style={{
                color: '#6B7280',
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'Inter_600SemiBold'
              }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDone}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 20,
                backgroundColor: '#125EC9',
                borderRadius: 8
              }}
            >
              <Text style={{
                color: 'white',
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'Inter_600SemiBold'
              }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CustomDatePicker;
