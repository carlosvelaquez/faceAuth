import React, { Component } from 'react';
import { Button, Image, Text, View, StyleSheet, ScrollView, Dimensions, TouchableNativeFeedback } from 'react-native';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as FaceDetector from 'expo-face-detector';
import { Camera } from 'expo-camera';
import * as Permissions from 'expo-permissions';

import { decode } from 'base-64';

import awsConfig from './aws.json';

const AWS = require('aws-sdk');
AWS.config.update(awsConfig);
const rekognition = new AWS.Rekognition();

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const NO_FACES = 0;
const SINGLE_FACE = 1;
const MULTIPLE_FACES = 2;
const SMILE_DETECTED = 3;
const SMILE_CAPTURED = 4;
const FACE_ACCEPTED = 5;
const FACE_REJECTED = 6;

const COLOR_BLUE = "#2196F3";
const COLOR_RED = "#f44336";
const COLOR_GREEN = "#4CAF50";
const COLOR_LIGHTGREEN = "#8BC34A";
const COLOR_ORANGE = "#FF9800";


export default class App extends Component {
  state = {
    pickerResult: null,
  };

  componentDidMount = async () => {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);
    this.setState({ hasCameraPermission: status === 'granted' });
  }

  _pickImg = async () => {
    let pickerResult = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      allowsEditing: false,
      aspect: [4, 3],
    });

    this.setState({
      pickerResult,
    });
  };

  getEncodedImage = () => {
    let { pickerResult } = this.state;
    let imageEncoded = pickerResult ? pickerResult.base64 : null;
    //if (imageEncoded) imageEncoded = imageEncoded.replace(/(?:\r\n|\r|\n)/g, '');

    return imageEncoded;
  }

  processImage = (imageEncoded) => {
    var image = decode(imageEncoded);
    var length = image.length;
    imageBytes = new ArrayBuffer(length);
    var ua = new Uint8Array(imageBytes);

    for (var i = 0; i < length; i++) {
      ua[i] = image.charCodeAt(i);
    }

    return imageBytes;
  }

  handleFaceDetection = (data) => {
    let faces = data.faces;

    if (faces.length > 1) {
      this.setState({ status: MULTIPLE_FACES })
    } else if (faces.length <= 0) {
      this.setState({ status: NO_FACES })
    } else {
      this.setState({ status: SINGLE_FACE })
      let face = faces[0];

      if (face.smilingProbability > .85 && this.camera) {
        //this.camera.pausePreview();
        this.setState(
          { status: SMILE_DETECTED }
        );

        console.log("Tomando foto...");
        this.camera.takePictureAsync({
          quality: 0.5,
          base64: true,
        }).then(async photo => {
          await this.camera.pausePreview();

          var params = {
            Image: {
              Bytes: this.processImage(photo.base64)
            },
            Attributes: [
              'ALL',
            ]
          };

          console.log("Reconociendo...");

          rekognition.detectFaces(params, (err, data) => {
            if (err) console.error(err, err.stack); // an error occurred
            else {
              console.log(data);           // successful response
              //this.setState({ faceData: data });
            }
          });


          this.setState(
            { status: SMILE_CAPTURED }
          );
        });
      }
    }
  }

  reset = () => {
    this.setState({ status: NO_FACES });
    if (this.camera) this.camera.resumePreview();
  }

  render() {
    const { hasCameraPermission } = this.state;

    let camera = <Camera
      ratio="16:9"
      ref={camera => this.camera = camera}
      flex={1}
      type={Camera.Constants.Type.front}
      onFacesDetected={this.handleFaceDetection}
      faceDetectorSettings={{
        mode: FaceDetector.Constants.Mode.fast,
        detectLandmarks: FaceDetector.Constants.Landmarks.none,
        runClassifications: FaceDetector.Constants.Classifications.all,
        minDetectionInterval: 1000,
        tracking: false,
      }}
    />;

    let currentLabel = "";
    let currentColor = "white";

    switch (this.state.status) {
      case NO_FACES: {
        currentLabel = "No se han detectado caras";
        currentColor = "black";
        break;
      }

      case MULTIPLE_FACES: {
        currentLabel = "Quitate maje";
        currentColor = COLOR_RED;
        break;
      }

      case SMILE_DETECTED: {
        currentLabel = "¡Sonrisa detectada!";
        currentColor = COLOR_LIGHTGREEN;
        break;
      }

      case SMILE_CAPTURED: {
        currentLabel = "Que sonrisa más secsi";
        currentColor = COLOR_GREEN;
        break;
      }

      default: {
        currentLabel = "Sonríe perra";
        currentColor = COLOR_BLUE;
        break;
      }
    }

    if (!hasCameraPermission)
      return <View flex={1}>
        <Text>No hay acceso a la cámara</Text>
      </View>
    else return <View style={styles.masterView}>
      <View style={styles.cameraView}>
        {camera}
      </View>
      <TouchableNativeFeedback
        onPress={this.state.status === SMILE_CAPTURED ? this.reset : () => console.log("Olo")}
        background={TouchableNativeFeedback.SelectableBackground()}>
        <View backgroundColor={currentColor} style={styles.buttonView}><Text style={styles.buttonText} flex={1}>{currentLabel}</Text></View>
      </TouchableNativeFeedback>
    </View>
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#ecf0f1',
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#34495e',
  },

  scrollView: {
    height: "100%"
  },

  masterView: {
    backgroundColor: "black",
    justifyContent: "space-around",
    alignItems: "center",
    flex: 1
  },

  cameraView: {
    width: screenWidth,
    height: screenWidth * 1.777777777777778,
    flex: 5
  },

  buttonView: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    width: "100%"
  },

  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "uppercase"
  }
});
