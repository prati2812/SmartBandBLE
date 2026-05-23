declare module 'react-native-base64' {
  const base64: {
    encode: (value: string) => string;
    decode: (value: string) => string;
  };

  export default base64;
}
