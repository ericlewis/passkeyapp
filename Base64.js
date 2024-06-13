const { btoa, atob } = require("react-native-quick-base64");
global.btoa = btoa;
global.atob = atob;