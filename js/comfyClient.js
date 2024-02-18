class ComfyClient {
  prompt_text = `
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

  constructor(serverAddress) {
    this.serverAddress = serverAddress;
    this.clientId = this.generateUUID();
    this.prompt = JSON.parse(this.prompt_text);
    this.prompt_id = null;
    this.ws = null;
  }

  init() {
    document.getElementById("queuePromptBtn").addEventListener("click", () => {
      this.queuePrompt();
    });
  }

  generateUUID() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    );
  }

  queuePrompt() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
      this.waitForOpenConnection()
        .then(() => {
          this.setPrompt();
          this.sendPrompt();
        })
        .catch((error) => {
          console.error("Error: ", error);
        });
    } else {
      this.setPrompt();
      this.sendPrompt();
    }
  }

  sendPrompt() {
    fetch(`http://${this.serverAddress}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: this.prompt, client_id: this.clientId }),
    })
      .then((response) => response.json())
      .then((data) => {
        this.prompt_id = data.prompt_id;
        console.log("Prompt queued with ID: ", data.prompt_id);
      });
  }

  displayImages(historyData) {
    const imagesContainer = document.getElementById("imagesContainer");
    imagesContainer.innerHTML = "";
    for (const node_id in historyData.outputs) {
      const nodeOutput = historyData.outputs[node_id];
      if ("images" in nodeOutput) {
        nodeOutput.images.forEach((image) => {
          const imageUrl = `http://${this.serverAddress}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
          const imgElement = document.createElement("img");
          imgElement.src = imageUrl;
          imagesContainer.appendChild(imgElement);
        });
      }
    }
  }

  waitForOpenConnection() {
    return new Promise((resolve, reject) => {
      const maxNumberOfAttempts = 10;
      const intervalTime = 200; // ms

      let currentAttempt = 0;
      const interval = setInterval(() => {
        if (currentAttempt > maxNumberOfAttempts - 1) {
          clearInterval(interval);
          reject(new Error("Maximum number of attempts reached"));
        } else if (this.ws.readyState === WebSocket.OPEN) {
          clearInterval(interval);
          resolve();
        }
        currentAttempt++;
      }, intervalTime);
    });
  }

  getImages(promptId) {
    console.log("Fetching images for prompt ID: ", promptId);
    fetch(`http://${this.serverAddress}/history/${promptId}`)
      .then((response) => response.json())
      .then((data) => {
        this.displayImages(data[promptId]);
      })
      .catch((error) => console.error("Error fetching images: ", error));
  }

  setPrompt({
    steps = 32,
    pos_text = "old-masterpiece painting best quality woman",
    neg_text = "bad hands, nude, naked, unclothed, watermark",
    seed = 8566257,
  } = {}) {
    this.prompt["6"]["inputs"]["text"] = pos_text;
    this.prompt["7"]["inputs"]["text"] = neg_text;
    this.prompt["3"]["inputs"]["steps"] = steps;
    this.prompt["3"]["inputs"]["seed"] = seed;
    return this.prompt;
  }

  connectWebSocket() {
    this.ws = new WebSocket(
      `ws://${this.serverAddress}/ws?clientId=${this.clientId}`
    );

    this.ws.onopen = () => {
      console.log("WebSocket connection established");
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "executing" && message.data.node === null) {
        const promptId = message.data.prompt_id;
        this.getImages(promptId); // Fetch images when execution is done
      }
    };

    this.ws.onerror = (error) => {
      console.log("WebSocket Error: " + error);
    };
  }
}
