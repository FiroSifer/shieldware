import joblib
import numpy as np
from tensorflow.keras.models import load_model

class model_service:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.label_encoder = None 
        self.ExpectedFeatures = [
            "cpu_usage",
            "cpu_user_time",
            "cpu_system_time",
            "cpu_idle_time",
            "interrupts_per_sec",
            "ram_usage",
            "page_faults_per_sec",
            "disk_read_bytes",
            "disk_write_bytes",
            "disk_read_ops",
            "disk_write_ops",
            "network_sent_bytes",
            "network_received_bytes",
            "Network_Bytes_Total_sec",
            "network_sent_packet",
            "network_received_packet",
        ]

    def load_model(self) -> bool:
        try:
            self.model = load_model("ids_mlp_model.keras")
            self.scaler = joblib.load("scaler.joblib")
            self.label_encoder = joblib.load("label_encoder.joblib")
            return True
        except Exception as e :
            print("failed to load model")
            return False

    def predict_model(self, metrics_dict : dict):
        if self.model is None or self.scaler is None or self.label_encoder is None:
            raise RuntimeError("ML artifacts not loaded yet!")

        try : 
            features_vector=[metrics_dict[key] for key in self.ExpectedFeatures]
        except KeyError as missing_key:
            raise ValueError("missing feature!",missing_key)     
        features = np.array([features_vector])

        scaled_features = self.scaler.transform(features)
        prediction = self.model.predict(scaled_features)

        prediction_indx = int(np.argmax(prediction, axis=1)[0])
        confidence = float(np.max(prediction,axis=1)[0])
        predicted_label = self.label_encoder.inverse_transform([prediction_indx])[0]

        return {
            "pred" : str(predicted_label),
            "confidence" : round(confidence, 4)
        }

modelService = model_service()    
