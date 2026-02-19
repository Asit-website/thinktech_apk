import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';

const CustomTimePicker = ({ visible, onClose, onSelect, initialTime }) => {
  const [selectedHour, setSelectedHour] = useState(initialTime ? initialTime.getHours() : new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState(initialTime ? initialTime.getMinutes() : new Date().getMinutes());
  const [isAM, setIsAM] = useState(selectedHour < 12);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleDone = () => {
    const hour24 = isAM ? (selectedHour === 12 ? 0 : selectedHour) : (selectedHour === 12 ? 12 : selectedHour + 12);
    const date = new Date();
    date.setHours(hour24, selectedMinute, 0, 0);
    onSelect(date);
    onClose();
  };

  const formatHour = (hour) => {
    return hour.toString().padStart(2, '0');
  };

  const formatMinute = (minute) => {
    return minute.toString().padStart(2, '0');
  };

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
          maxWidth: 400
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
              Select Time
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 24, color: '#6B7280' }}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Time Display */}
          <View style={{
            padding: 20,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB'
          }}>
            <Text style={{
              fontSize: 32,
              fontWeight: '600',
              color: '#111827',
              fontFamily: 'Inter_600SemiBold'
            }}>
              {formatHour(selectedHour)}:{formatMinute(selectedMinute)} {isAM ? 'AM' : 'PM'}
            </Text>
          </View>

          {/* Time Selection */}
          <View style={{
            flexDirection: 'row',
            padding: 16,
            gap: 16
          }}>
            {/* Hours */}
            <View style={{ flex: 1 }}>
              <Text style={{
                textAlign: 'center',
                fontSize: 14,
                fontWeight: '600',
                color: '#6B7280',
                marginBottom: 8,
                fontFamily: 'Inter_600SemiBold'
              }}>
                Hour
              </Text>
              <ScrollView style={{ height: 120 }}>
                {hours.map(hour => (
                  <TouchableOpacity
                    key={hour}
                    onPress={() => setSelectedHour(hour)}
                    style={{
                      padding: 8,
                      alignItems: 'center',
                      backgroundColor: selectedHour === hour ? '#125EC9' : 'transparent',
                      borderRadius: 6,
                      marginVertical: 2
                    }}
                  >
                    <Text style={{
                      fontSize: 16,
                      color: selectedHour === hour ? 'white' : '#111827',
                      fontWeight: selectedHour === hour ? '600' : '400',
                      fontFamily: selectedHour === hour ? 'Inter_600SemiBold' : 'Inter_400Regular'
                    }}>
                      {formatHour(hour)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Minutes */}
            <View style={{ flex: 1 }}>
              <Text style={{
                textAlign: 'center',
                fontSize: 14,
                fontWeight: '600',
                color: '#6B7280',
                marginBottom: 8,
                fontFamily: 'Inter_600SemiBold'
              }}>
                Minute
              </Text>
              <ScrollView style={{ height: 120 }}>
                {minutes.filter(min => min % 5 === 0).map(minute => (
                  <TouchableOpacity
                    key={minute}
                    onPress={() => setSelectedMinute(minute)}
                    style={{
                      padding: 8,
                      alignItems: 'center',
                      backgroundColor: selectedMinute === minute ? '#125EC9' : 'transparent',
                      borderRadius: 6,
                      marginVertical: 2
                    }}
                  >
                    <Text style={{
                      fontSize: 16,
                      color: selectedMinute === minute ? 'white' : '#111827',
                      fontWeight: selectedMinute === minute ? '600' : '400',
                      fontFamily: selectedMinute === minute ? 'Inter_600SemiBold' : 'Inter_400Regular'
                    }}>
                      {formatMinute(minute)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* AM/PM */}
            <View style={{ flex: 1 }}>
              <Text style={{
                textAlign: 'center',
                fontSize: 14,
                fontWeight: '600',
                color: '#6B7280',
                marginBottom: 8,
                fontFamily: 'Inter_600SemiBold'
              }}>
                Period
              </Text>
              <View style={{ height: 120, justifyContent: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setIsAM(true)}
                  style={{
                    padding: 8,
                    alignItems: 'center',
                    backgroundColor: isAM ? '#125EC9' : 'transparent',
                    borderRadius: 6
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    color: isAM ? 'white' : '#111827',
                    fontWeight: isAM ? '600' : '400',
                    fontFamily: isAM ? 'Inter_600SemiBold' : 'Inter_400Regular'
                  }}>
                    AM
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsAM(false)}
                  style={{
                    padding: 8,
                    alignItems: 'center',
                    backgroundColor: !isAM ? '#125EC9' : 'transparent',
                    borderRadius: 6
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    color: !isAM ? 'white' : '#111827',
                    fontWeight: !isAM ? '600' : '400',
                    fontFamily: !isAM ? 'Inter_600SemiBold' : 'Inter_400Regular'
                  }}>
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

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

export default CustomTimePicker;
