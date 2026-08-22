from tensorflow.keras.models import load_model

model = load_model("potato_model.h5", compile=False)
print("Model loaded successfully")
print(model.input_shape)
print(model.output_shape)
