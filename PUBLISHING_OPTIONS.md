# Publishing Options - Where to Host Your Art

## Quick Comparison

| Platform | Setup Time | Cost | Best For | Auto-Deploy |
|----------|------------|------|----------|-------------|
| **Netlify** | 2 min | Free | Easiest start | Yes |
| **Vercel** | 3 min | Free | Professional | Yes |
| **GitHub Pages** | 5 min | Free | Open source | Yes |
| **Cloudflare Pages** | 5 min | Free | Speed | Yes |
| **Your own server** | Varies | $5-20/mo | Full control | Manual |

## Option 1: Netlify (Recommended First)

**Pros:**
- Literally drag & drop
- Instant preview URLs
- Custom domain free
- Form handling
- Analytics included

**Two Ways:**

### A. Drag & Drop (30 seconds)
1. Go to https://app.netlify.com/drop
2. Drag your `dist` folder
3. Get URL: `https://genart2025.netlify.app`
4. Share immediately!

### B. Git Integration (Best for iterations)
1. Push project to GitHub
2. New Site from Git on Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Every git push = auto-deploy!

**Custom Domain:**
- Domain settings → Add custom domain
- Point your DNS
- Free SSL certificate

**Cost:** Free forever for personal projects

---

## Option 2: Vercel

**Pros:**
- Fastest edge network
- Great developer experience
- Automatic HTTPS
- Preview deployments

**Setup:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd /Users/markgould/Documents/GenArt2025
vercel

# Follow prompts (takes 1 minute)
# Get URL: https://genart2025.vercel.app
```

**Or use GitHub:**
1. Import project on vercel.com
2. Auto-detects Vite
3. Auto-deploys on push

**Cost:** Free for hobby projects

---

## Option 3: GitHub Pages

**Pros:**
- Free hosting with GitHub
- Good for open source
- Shows code + demo together
- Version control built-in

**Setup:**
```bash
npm install --save-dev gh-pages

# Add to package.json scripts:
"deploy": "gh-pages -d dist"

# Deploy
npm run build
npm run deploy
```

**URL:** `https://yourusername.github.io/GenArt2025/`

**Note:** Need to add this to `vite.config.js`:
```javascript
export default {
  base: '/GenArt2025/'
}
```

**Cost:** Free

---

## Option 4: Cloudflare Pages

**Pros:**
- Fastest global CDN
- Unlimited bandwidth
- Great analytics
- DDoS protection

**Setup:**
1. Connect GitHub repo
2. Build: `npm run build`
3. Output: `dist`
4. Deploy

**URL:** `https://genart2025.pages.dev`

**Cost:** Free

---

## Option 5: Your Own Server

**If you have web hosting:**
1. Build: `npm run build`
2. Upload `dist` contents via FTP/SFTP
3. Point to your domain

**Hosts that work well:**
- **Dreamhost** - $2.59/mo
- **SiteGround** - $3.99/mo
- **DigitalOcean** - $5/mo (more technical)

---

## Art-Specific Platforms

### OpenProcessing.org
- Community of generative artists
- Built-in viewer
- Tags for discovery
- Can't use your code directly (p5.js based)

### CodePen.io
- Live code editor
- Embeddable
- Great for portfolio
- Limited to single HTML file (can work with build)

### Glitch.com
- Live editing
- Remix-able
- Good for teaching
- Free hosting

---

## Recommended Strategy

**Week 1: Test**
- Netlify Drop → Quick sharing with friends
- Get feedback

**Week 2: Iterate**
- GitHub → Version control
- Netlify Git → Auto-deploy on changes
- Custom domain if desired

**Week 3: Expand**
- Keep Netlify as primary
- Add GitHub Pages for open source
- Submit to art showcases

---

## Custom Domain Setup

**Buy domain:** ($10-15/year)
- Namecheap.com
- Google Domains
- Cloudflare Registrar

**Point to Netlify/Vercel:**
1. Add domain in platform settings
2. Update DNS records:
   ```
   A record → Points to their server
   CNAME → www subdomain
   ```
3. Wait 5-60 minutes
4. Free SSL certificate auto-added

**Examples:**
- `genart.yourname.com`
- `visualizations.yoursite.com`
- `art2025.yourname.com`

---

## Multiple Versions Strategy

**Recommended setup:**

```
yoursite.com/genart/       → Latest stable (V2)
yoursite.com/genart/v1/    → Classic version
yoursite.com/genart/v3/    → Experimental
yoursite.com/genart/beta/  → Testing new features
```

**On Netlify:**
- Create separate sites for each version
- Or use branch deploys (automatic)

**On Your Server:**
- Upload different builds to different folders

---

## Video Hosting for Demos

**YouTube:**
- Unlimited uploads
- Best for long-form (2-10 min)
- Link in description to live demo
- Good for tutorials

**Vimeo:**
- High quality
- Artistic community
- Good for portfolio
- Free: 500MB/week

**Instagram/TikTok:**
- Short clips (15-90 sec)
- Discovery potential
- Link in bio to full demo

**Self-hosted:**
- Use Cloudflare Stream ($1/1000 views)
- Or Bunny CDN ($0.005/GB)

---

## Embedding Guide

**In your blog:**
```html
<div style="max-width: 1200px; margin: 40px auto;">
  <iframe
    src="https://genart2025.netlify.app"
    width="100%"
    height="800px"
    frameborder="0"
    allow="autoplay">
  </iframe>
  <p style="text-align: center; margin-top: 10px;">
    <a href="https://genart2025.netlify.app" target="_blank">
      Open in full screen
    </a>
  </p>
</div>
```

**Responsive embed:**
```html
<style>
.genart-embed {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 */
  height: 0;
  overflow: hidden;
}
.genart-embed iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>

<div class="genart-embed">
  <iframe src="https://genart2025.netlify.app"></iframe>
</div>
```

---

## Performance Tips

**All platforms:**
1. Vite already optimizes for you
2. Your bundle is small (~260KB)
3. Will load fast on all platforms

**CDN benefits:**
- Netlify/Vercel/Cloudflare use global CDN
- Visitors get content from nearest server
- Faster than your own hosting

**Caching:**
- Platforms handle this automatically
- Your static assets cached at edge
- Audio files load on-demand

---

## Analytics (Optional)

**Simple (Privacy-friendly):**
- **Plausible** - $9/mo, beautiful, privacy-focused
- **Fathom** - $14/mo, similar
- **Netlify Analytics** - $9/mo, built-in

**Free:**
- **Google Analytics** - Powerful but complex
- **Cloudflare Web Analytics** - Simple, privacy-focused

**Add to `index.html`:**
```html
<!-- Plausible -->
<script defer data-domain="yourdomain.com"
  src="https://plausible.io/js/script.js"></script>

<!-- Or Google Analytics -->
<script async
  src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXX">
</script>
```

---

## My Recommendation

**For you specifically:**

1. **Now:** Netlify Drop
   - Drag `dist` folder
   - Get immediate URL
   - Share with first readers

2. **This Week:** GitHub + Netlify Git
   - Push to GitHub (backup)
   - Connect Netlify
   - Auto-deploy on iterations

3. **Next Week:** Custom domain (optional)
   - Buy `yourname.art` or subdomain
   - Point to Netlify
   - Professional presence

4. **Ongoing:** Keep iterating
   - Git push = new deploy
   - Preview URLs for experiments
   - Stable URL for readers

**Cost:** $0 (or $10/year if you want custom domain)

---

## Quick Start (Right Now)

```bash
# Your dist folder is already built!
# Option 1: Netlify Drop
# → Open https://app.netlify.com/drop
# → Drag /Users/markgould/Documents/GenArt2025/dist
# → Get URL in 30 seconds

# Option 2: Vercel CLI
npm install -g vercel
cd /Users/markgould/Documents/GenArt2025
vercel
# → Answer prompts
# → Get URL in 60 seconds
```

Choose one and you'll be live in under 2 minutes!
