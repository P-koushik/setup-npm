export type FrontendConfig = {
  platform: 'web' | 'native';
  framework: 'next' | 'angular' | 'vue' | 'vite' | 'expo' | 'react-native';
  projectName: string;
};
