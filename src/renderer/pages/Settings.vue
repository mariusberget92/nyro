<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'
const s = useSettingsStore()

const apiKeyInput = ref(s.settings.listenNotesApiKey || '')
const apiKeySaving = ref(false)
const apiKeySaved = ref(false)

const apiKeyIsSet = computed(() => !!s.settings.listenNotesApiKey)

async function saveApiKey() {
  apiKeySaving.value = true
  await s.update({ listenNotesApiKey: apiKeyInput.value })
  apiKeySaving.value = false
  apiKeySaved.value = true
  setTimeout(() => { apiKeySaved.value = false }, 2000)
}
</script>

<template>
  <div class="settings">
    <header class="settings-header">
      <h1 class="settings-title">Settings</h1>
    </header>

    <div class="settings-body">

      <!-- ListenNotes API Key -->
      <section class="section">
        <label class="section-label">
          LISTENNOTES API KEY
          <span v-if="apiKeyIsSet" class="key-set-badge">✓ SET</span>
        </label>
        <div class="folder-row">
          <input
            v-model="apiKeyInput"
            type="password"
            class="api-key-input"
            placeholder="Paste your API key here"
          />
          <button class="btn-ghost" :disabled="apiKeySaving" @click="saveApiKey">
            {{ apiKeySaved ? 'Saved!' : 'Save' }}
          </button>
        </div>
        <span class="section-desc">Get your free API key at <a href="https://www.listennotes.com/api/" target="_blank" class="link">listennotes.com/api</a></span>
      </section>

      <!-- Cookie browser -->
      <section class="section">
        <label class="section-label">
          BROWSER COOKIES
          <span v-if="s.settings.cookiesBrowser" class="key-set-badge">✓ {{ s.settings.cookiesBrowser.toUpperCase() }}</span>
        </label>
        <div class="toggle-group flex-wrap">
          <button
            v-for="b in (['chrome','firefox','edge','brave','opera','vivaldi','safari'] as const)"
            :key="b"
            :class="['density-btn', { active: s.settings.cookiesBrowser === b }]"
            @click="s.update({ cookiesBrowser: s.settings.cookiesBrowser === b ? '' : b })"
          >{{ b[0].toUpperCase() + b.slice(1) }}</button>
        </div>
        <span class="section-desc">
          Pass cookies from your browser to bypass bot-detection or age-gated videos.
          The browser must be installed and you must be signed in to YouTube.
          <span v-if="s.settings.cookiesBrowser" class="warn-text">Active — yt-dlp will read cookies from {{ s.settings.cookiesBrowser }}.</span>
        </span>
      </section>

      <!-- Output folder -->
      <section class="section">
        <label class="section-label">OUTPUT FOLDER</label>
        <div class="folder-row">
          <span class="folder-path">{{ s.settings.outputFolder || 'Not set' }}</span>
          <button class="btn-ghost" @click="s.selectFolder()">Browse</button>
        </div>
      </section>

      <!-- Download mode -->
      <section class="section">
        <label class="section-label">DOWNLOAD MODE</label>
        <div class="toggle-group">
          <button :class="['density-btn', { active: s.settings.downloadMode === 'audio' }]" @click="s.update({ downloadMode: 'audio' })">Audio MP3</button>
          <button :class="['density-btn', { active: s.settings.downloadMode === 'video' }]" @click="s.update({ downloadMode: 'video' })">Video MP4</button>
        </div>
      </section>

      <!-- Video quality (shown only in video mode) -->
      <section v-if="s.settings.downloadMode === 'video'" class="section">
        <label class="section-label">VIDEO QUALITY</label>
        <div class="toggle-group">
          <button
            v-for="q in (['4K', '1080p', '720p', '480p'] as const)"
            :key="q"
            :class="['density-btn', { active: s.settings.videoQuality === q }]"
            @click="s.update({ videoQuality: q })"
          >{{ q }}</button>
        </div>
      </section>

      <!-- Density -->
      <section class="section">
        <label class="section-label">DENSITY</label>
        <div class="toggle-group">
          <button :class="['density-btn', { active: s.density === 'comfortable' }]" @click="s.setDensity('comfortable')">Comfortable</button>
          <button :class="['density-btn', { active: s.density === 'compact' }]" @click="s.setDensity('compact')">Compact</button>
        </div>
      </section>

      <!-- Corner radius -->
      <section class="section">
        <label class="section-label">CORNER RADIUS — {{ s.cornerRadius }}px</label>
        <input
          type="range" min="2" max="18" step="1"
          :value="s.cornerRadius"
          class="slider"
          @input="s.setRadius(+($event.target as HTMLInputElement).value)"
        />
      </section>

      <!-- Accent color -->
      <section class="section">
        <label class="section-label">ACCENT COLOR</label>
        <div class="color-row">
          <input
            type="color"
            :value="s.accentColor"
            class="color-input"
            @input="s.setAccent(($event.target as HTMLInputElement).value)"
          />
          <span class="color-value">{{ s.accentColor }}</span>
          <button class="btn-ghost small" @click="s.setAccent('#88c0d0')">Reset</button>
        </div>
      </section>

      <!-- Number prefix -->
      <section class="section">
        <label class="section-label">FILENAME NUMBER PREFIX</label>
        <div class="row-between">
          <span class="section-desc">Prepend a numbered prefix to filenames</span>
          <button
            class="toggle-btn"
            :class="{ active: s.settings.numericPrefix }"
            @click="s.update({ numericPrefix: !s.settings.numericPrefix })"
          >
            <span class="toggle-knob" />
          </button>
        </div>
        <template v-if="s.settings.numericPrefix">
          <label class="section-label" style="margin-top:4px">PREFIX TEMPLATE</label>
          <div class="prefix-row">
            <input
              class="prefix-input"
              :value="s.settings.prefixTemplate"
              placeholder="{000} - "
              @change="s.update({ prefixTemplate: ($event.target as HTMLInputElement).value })"
            />
            <div class="prefix-preview">
              <span class="preview-label">PREVIEW</span>
              <span class="preview-val">{{ (s.settings.prefixTemplate || '{000} - ').replace(/\{(0+)\}/g, (_:string, z:string) => '1'.padStart(z.length, '0')) }}Artist – Song.mp3</span>
            </div>
          </div>
          <span class="section-desc"><code>{0}</code> = 1 digit &nbsp;·&nbsp; <code>{00}</code> = 2 digits &nbsp;·&nbsp; <code>{000}</code> = 3 digits &nbsp;·&nbsp; Mix freely: <code>EP{00} - </code></span>
        </template>
      </section>

      <!-- Audio quality -->
      <section class="section">
        <label class="section-label">AUDIO QUALITY (kbps)</label>
        <div class="toggle-group flex-wrap">
          <button
            v-for="q in (['64','96','128','160','192','256','320','384','448'] as const)"
            :key="q"
            :class="['density-btn', { active: s.settings.audioQuality === q }]"
            @click="s.update({ audioQuality: q })"
          >{{ q }}</button>
        </div>
      </section>

      <!-- Concurrent downloads (disabled) -->
      <section class="section disabled-section">
        <label class="section-label">CONCURRENT DOWNLOADS <span class="coming-soon">COMING SOON</span></label>
        <input type="range" min="1" max="5" value="1" class="slider" disabled />
        <span class="section-desc">Currently limited to 1 simultaneous download</span>
      </section>

    </div>
  </div>
</template>

<style scoped>
.settings { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.settings-header {
  height: 56px; padding: 0 18px;
  display: flex; align-items: center;
  background: var(--bg-0); border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.settings-title { font-size: 17px; font-weight: 800; color: var(--tx); margin: 0; }
.settings-body { flex: 1; overflow-y: auto; padding: 20px 18px; display: flex; flex-direction: column; gap: 24px; }
.section { display: flex; flex-direction: column; gap: 8px; }
.section-label { font-size: 10.5px; font-weight: 700; color: var(--tx-faint); letter-spacing: 0.06em; text-transform: uppercase; }
.section-desc { font-size: 12px; color: var(--tx-faint); }
.folder-row { display: flex; align-items: center; gap: 10px; }
.folder-path {
  flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 12px;
  color: var(--tx-dim); background: var(--bg-2); padding: 8px 12px;
  border-radius: 8px; border: 1px solid var(--line-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.toggle-group { display: flex; gap: 4px; }
.density-btn {
  padding: 6px 14px; border-radius: 8px; border: 1.5px solid var(--line-2);
  background: transparent; color: var(--tx-dim); font-size: 12.5px; font-weight: 600; cursor: pointer;
  transition: all 0.15s;
}
.density-btn.active { background: var(--bg-3); border-color: var(--accent); color: var(--tx); }
.slider {
  -webkit-appearance: none; width: 100%; height: 4px;
  background: var(--bg-3); border-radius: 2px; outline: none; cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px;
  border-radius: 50%; background: var(--accent); cursor: pointer;
  box-shadow: 0 0 0 3px rgba(61,127,255,0.2);
}
.slider:disabled { opacity: 0.35; cursor: not-allowed; }
.slider:disabled::-webkit-slider-thumb { cursor: not-allowed; }
.color-row { display: flex; align-items: center; gap: 10px; }
.color-input { width: 40px; height: 40px; border: none; border-radius: 8px; cursor: pointer; padding: 2px; background: var(--bg-2); }
.color-value { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--tx-dim); }
.btn-ghost {
  padding: 7px 14px; border-radius: 8px; border: 1.5px solid var(--line-2);
  background: transparent; color: var(--tx-dim); font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.btn-ghost:hover { color: var(--tx); background: var(--bg-3); }
.btn-ghost.small { padding: 5px 10px; font-size: 11.5px; }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.toggle-btn {
  width: 40px; height: 22px; border-radius: 11px; border: none;
  background: var(--bg-3); cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0;
}
.toggle-btn.active { background: var(--accent); }
.toggle-knob {
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.2s;
}
.toggle-btn.active .toggle-knob { transform: translateX(18px); }
.info-value { font-size: 12.5px; color: var(--tx-dim); }
code { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--tx-dim); }
.api-key-input {
  flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 12px;
  color: var(--tx); background: var(--bg-2); padding: 8px 12px;
  border-radius: 8px; border: 1px solid var(--line-2); outline: none;
}
.api-key-input:focus { border-color: var(--accent); }
.key-set-badge {
  display: inline-block; margin-left: 8px;
  padding: 1px 6px; border-radius: 4px;
  background: rgba(34, 197, 94, 0.15); color: #22c55e;
  font-size: 9px; font-weight: 700; letter-spacing: 0.04em; vertical-align: middle;
}
.link { color: var(--accent); text-decoration: none; }
.link:hover { text-decoration: underline; }
.warn-text { color: var(--warn); display: block; margin-top: 4px; }
.disabled-section { opacity: 0.5; pointer-events: none; }
.flex-wrap { flex-wrap: wrap; }
.prefix-row { display: flex; flex-direction: column; gap: 8px; }
.prefix-input {
  height: 36px; padding: 0 12px; width: 100%;
  background: var(--bg-2); border: 1.5px solid var(--line-2); border-radius: 8px;
  color: var(--tx); font-family: 'JetBrains Mono', monospace; font-size: 13px; outline: none;
}
.prefix-input:focus { border-color: var(--accent); }
.prefix-preview {
  display: flex; flex-direction: column; gap: 3px;
  padding: 10px 12px; background: var(--bg-2); border-radius: 8px;
  border: 1px solid var(--line);
}
.preview-label { font-size: 9px; font-weight: 700; color: var(--tx-faint); letter-spacing: 0.06em; text-transform: uppercase; }
.preview-val { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ok); }
.coming-soon {
  display: inline-block; margin-left: 6px;
  padding: 1px 5px; border-radius: 4px;
  background: var(--bg-3); color: var(--tx-faint);
  font-size: 9px; letter-spacing: 0.04em; vertical-align: middle;
}
</style>
