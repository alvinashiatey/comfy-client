const serverAddress = "127.0.0.1:8188";
const clientId = generateUUID();

async function getImages(promptId) {
  const response = await fetch(`http://${serverAddress}/history/${promptId}`);
  const data = await response.json();
  const history = data[promptId];
  for (const node_id in history.outputs) {
    const node_output = history.outputs[node_id];
    if ("images" in node_output) {
      node_output.images.forEach((image) =>
        displayImage(image.filename, image.subfolder, image.type)
      );
    }
  }
}

async function displayImage(filename, subfolder, type) {
  const imageUrl = `http://${serverAddress}/view?filename=${encodeURIComponent(
    filename
  )}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(
    type
  )}`;
  const imgElement = document.createElement("img");
  imgElement.src = imageUrl;
  document.getElementById("images").appendChild(imgElement);
}

function generateUUID() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

const prompt_text = `
{
    "3": {
        "class_type": "KSampler",
        "inputs": {
            "cfg": 8,
            "denoise": 1,
            "latent_image": [
                "5",
                0
            ],
            "model": [
                "4",
                0
            ],
            "negative": [
                "7",
                0
            ],
            "positive": [
                "6",
                0
            ],
            "sampler_name": "euler",
            "scheduler": "normal",
            "seed": 8566257,
            "steps": 32
        }
    },
    "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": {
            "ckpt_name": "sd_xl_base_1.0.safetensors"
        }
    },
    "5": {
        "class_type": "EmptyLatentImage",
        "inputs": {
            "batch_size": 1,
            "height": 1024,
            "width": 1024
        }
    },
    "6": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": [
                "4",
                1
            ],
            "text": "old-masterpiece painting best quality woman"
        }
    },
    "7": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": [
                "4",
                1
            ],
            "text": "bad hands"
        }
    },
    "8": {
        "class_type": "VAEDecode",
        "inputs": {
            "samples": [
                "3",
                0
            ],
            "vae": [
                "4",
                2
            ]
        }
    },
    "9": {
        "class_type": "SaveImage",
        "inputs": {
            "filename_prefix": "ComfyUI",
            "images": [
                "8",
                0
            ]
        }
    }
}
`;

async function queuePrompt(prompt) {
  const response = await fetch(`http://${serverAddress}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: prompt, client_id: clientId }),
  });
  const data = await response.json();
  console.log("Prompt queued with ID: ", data.prompt_id);
}

const prompt = JSON.parse(prompt_text);
prompt["6"]["inputs"]["text"] = "old-masterpiece painting best quality woman";
prompt["3"]["inputs"]["steps"] = 20;

function connectWebSocket() {
  const ws = new WebSocket(`ws://${serverAddress}/ws?clientId=${clientId}`);

  ws.onopen = function () {
    console.log("WebSocket connection established");
    queuePrompt(prompt); // Send prompt after establishing connection
  };

  ws.onmessage = function (event) {
    const message = JSON.parse(event.data);
    if (message.type === "executing" && message.data.node === null) {
      const promptId = message.data.prompt_id;
      getImages(promptId); // Fetch images when execution is done
    }
  };

  ws.onerror = function (error) {
    console.log("WebSocket Error: " + error);
  };
}

connectWebSocket();
