# Local image generator (Apple Silicon)

Runs **Stable Diffusion 1.5** or **Stable Diffusion XL** locally via **PyTorch MPS**. Safety checker is **always disabled** (fully uncensored inference — lawful use is on you).

Two entry points:

1. **`./run.sh`** — HTTP API (`POST /generate`).
2. **`./run_cli.sh`** — single-image CLI (best for long runs / huge step counts).

### Quick presets

| Goal | Command |
|------|---------|
| Classic SD 1.5 (small download, fast) | `./run.sh` or `./run_cli.sh …` |
| **SDXL on ~16 GB** (better anatomy / composition) | `./run_sdxl.sh` or `./run_cli_sdxl.sh …` |

First SDXL launch downloads several GB from Hugging Face.

On Apple Silicon, SD **1.5** defaults to **fp32 on MPS** (reliable VAE). SD **XL** defaults to **fp16 weights + automatic VAE fp32 decode** (`upcast_vae`) so XL fits ~16 GB unified RAM without CUDA-style CPU offload (which Diffusers still wires primarily for NVIDIA).

## Prerequisites

- macOS on **Apple Silicon**
- **Homebrew** `python@3.12` (avoid system Python 3.14 for PyTorch wheels)
- Network on first run (weights download)

## One-time setup

```bash
cd tools/local-image-gen
chmod +x bootstrap.sh run.sh run_cli.sh run_sdxl.sh run_cli_sdxl.sh generate_cli.py batch_arena_queue.py
./bootstrap.sh
```

After pulling these upgrades, reinstall deps once:

```bash
source .venv/bin/activate
pip install -U -r requirements.txt
```

## Backends & models

| Env | Values | Notes |
|-----|--------|------|
| **`LOCAL_SD_BACKEND`** | `sd15` (default), `sdxl` | Switches pipeline class |
| **`LOCAL_SD_MODEL_ID`** | HF repo id | Defaults: `runwayml/stable-diffusion-v1-5` vs `stabilityai/stable-diffusion-xl-base-1.0` |
| **`LOCAL_SD_PRECISION`** | `auto`, `fp16`, `fp32` | **auto**: SD15+MPS→fp32; SDXL+MPS→fp16; CPU→fp32 unless forced |

Uncensored **merge checkpoints** (CyberRealistic XL, etc.) work as drop-ins: set `LOCAL_SD_MODEL_ID` to the Diffusers-format repo. If a repo has **no `fp16` variant**, use `LOCAL_SD_PRECISION=fp32` (uses more RAM — may OOM at large resolutions on 16 GB).

| **`LOCAL_SD_UPCAST_VAE`** | unset / `1` / `0` | **unset** = auto (**on** whenever weights are fp16). Forces fp32 VAE decode → clearer XL output on MPS, slightly slower decode. (Implemented via `pipe.vae.to(float32)` — current Diffusers exposes `upcast_vae` as a **method** on XL pipes, so assigning `pipe.upcast_vae = True` would break decode.) |

## Schedulers & steps

| `LOCAL_SD_SCHEDULER` | Meaning |
|----------------------|---------|
| `dpmpp` | **DPM++ 2M + Karras** (default) |
| `euler_a` | Euler ancestral |
| `pretrained` | Checkpoint default |

**SD 1.5:** **30–50** steps at **512×512** is the practical daily driver on 16 GB.

**SDXL:** start **24–36** steps; XL improves faster per step than 1.5. Prefer **native-ish resolutions**:

- **768×768** — safest XL square on **16 GB**.
- **896×896** or **1024×1024** — try if idle RAM is available; **close browsers first**. If PyTorch aborts / kills the process, drop size or steps.

## Example CLI (SDXL)

```bash
./run_cli_sdxl.sh \
  -p "…short photo-focused prompt…" \
  -n "anime, cartoon, deformed, low quality …" \
  --steps 28 \
  --width 896 \
  --height 896 \
  --guidance 7 \
  -o ~/Desktop/xl_scene_v1.png
```

SDXL uses **two CLIP stacks** — you're still punished for novellas in the prompt; **short beats + strong nouns** win.

## HTTP server

```bash
./run.sh              # SD 1.5
./run_sdxl.sh         # SDXL preset
```

`GET /health` returns device caps plus **`LAST_BUILD`** metadata (`backend`, `dtype`, `upcast_vae`, `scheduler`, …).

`POST /generate` — same JSON as before (`prompt`, `negative_prompt`, `steps`, `width`, `height`, `guidance_scale`, `seed`, optional step-save fields).

Very large XL jobs → prefer **`run_cli_*`** so nothing HTTP-times-out.

## Save each diffusion step (progress frames)

Same as before — **much slower** (full VAE decode each step). CLI: `--save-each-step-dir`; HTTP: `save_each_step_dir`.

On SDXL + fp16 + step-saving, previews may occasionally look noisier than the final `upcast_vae` frame — that's a known limitation of decoding raw latents mid-schedule.

## Environment (reference)

| Variable | Default |
|----------|---------|
| `LOCAL_SD_BACKEND` | `sd15` |
| `LOCAL_SD_MODEL_ID` | per backend |
| `LOCAL_SD_PRECISION` | `auto` |
| `LOCAL_SD_UPCAST_VAE` | auto (`on` for fp16 weights) |
| `LOCAL_SD_SCHEDULER` | `dpmpp` |
| `LOCAL_SD_DEFAULT_STEPS` / `LOCAL_SD_MAX_STEPS` | 40 / 200 |
| `LOCAL_SD_MAX_SIDE` | 1024 |
| `LOCAL_SD_HOST` / `LOCAL_SD_PORT` | `127.0.0.1` / `8787` |

## Saving into repo assets

```bash
./run_cli_sdxl.sh -p "…" --steps 28 --width 896 --height 896 \
  -o ../../assets/scenes/<story_slug>/scene_name_v2.png
```

## Batch helper (`batch_arena_queue.py`)

Serial jobs via `queue/*.txt`. Bump **`STEPS`** / **`W`** / **`H`** in the script when using SDXL (defaults remain **512 / 40** for backward compatibility).

## Honest roadmap (not implemented here)

If XL still melts limbs at tough compositions: **ControlNet** + pose/canny edges (extra code + preprocess deps), **IP-Adapter** for cast-locking faces, **img2img** refinement, or **ComfyUI** graph workflows — all stay local & uncensored but need another integration pass.

## Notes

- **HF auth:** `HF_TOKEN` or `huggingface-cli login` speeds downloads / avoids rate limits on big repos.
- **Restart hung server:** If `/health` works but `/generate` hangs forever, kill the listener on **8787** and `./run.sh` again (`CLAUDE.md` project notes spell this out).
