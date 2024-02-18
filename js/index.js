document.addEventListener("DOMContentLoaded", function () {
  const serverAddress = "127.0.0.1:8188";
  const comfyClient = new ComfyClient(serverAddress);
  comfyClient.init();
});
