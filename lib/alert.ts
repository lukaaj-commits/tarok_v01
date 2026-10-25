import { Alert, Platform } from 'react-native';

// Sporočilo, ki deluje tudi na spletu (Alert.alert na spletu ne prikaže ničesar)
export const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};
