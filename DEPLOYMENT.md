# Deployment Guide for GenArt2025

Your audio-responsive generative art project is ready to share with your readers! Here are several options for deploying it online.

## Quick Deploy Options

### Option 1: Netlify (Recommended - Easiest)

1. **Sign up for Netlify** (free): https://www.netlify.com

2. **Deploy via Drag & Drop:**
   - Run `npm run build` (already done!)
   - Go to https://app.netlify.com/drop
   - Drag the `dist` folder onto the page
   - Your site will be live in seconds!
   - Netlify will give you a URL like: `https://random-name-123.netlify.app`
   - You can customize the domain name in settings

3. **OR Deploy via GitHub:**
   - Push your code to GitHub
   - Connect your GitHub repo to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `dist`
   - Netlify will auto-deploy on every push!

### Option 2: Vercel

1. **Sign up for Vercel** (free): https://vercel.com

2. **Deploy:**
   - Install Vercel CLI: `npm install -g vercel`
   - Run `vercel` in your project directory
   - Follow the prompts
   - Your site will be live with a URL like: `https://genart2025.vercel.app`

3. **OR via GitHub:**
   - Push to GitHub
   - Import your repo on Vercel dashboard
   - Auto-deploys on every push

### Option 3: GitHub Pages

1. **Install gh-pages:**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add to package.json scripts:**
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

4. **Your site will be at:**
   `https://[your-username].github.io/GenArt2025/`

5. **Configure base path** in `vite.config.js`:
   ```javascript
   export default {
     base: '/GenArt2025/'
   }
   ```

### Option 4: Cloudflare Pages

1. **Sign up**: https://pages.cloudflare.com
2. Connect your GitHub repo
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy!

## Custom Domain

All of these services allow you to use a custom domain:
- In your hosting provider's dashboard, go to Domain Settings
- Add your custom domain
- Update your DNS records (they'll provide instructions)

## Embedding in Your Blog/Website

If you want to embed the visualization in an existing blog post:

### iFrame Method

```html
<iframe
  src="https://your-deployed-url.com"
  width="100%"
  height="800px"
  frameborder="0"
  allow="autoplay; microphone">
</iframe>
```

### Direct Integration

Copy the files from `dist/` to your web server and include them in your page.

## Performance Tips

1. **Enable Compression:** Most hosting services do this automatically
2. **Use CDN:** Netlify, Vercel, and Cloudflare include global CDN
3. **Browser Caching:** Set in your hosting provider's settings

## Analytics (Optional)

Add Google Analytics or Plausible to track visitors:

In `index.html`, add before closing `</head>`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR-ID');
</script>
```

## Sharing with Readers

Once deployed, share with your audience:
- Direct link to the live visualization
- QR code for mobile access
- Social media previews (add Open Graph meta tags)
- Embed in blog posts

## Adding Open Graph Tags

For better social media sharing, add to `index.html` `<head>`:

```html
<meta property="og:title" content="GenArt2025 - Audio-Responsive Fall Art">
<meta property="og:description" content="Interactive generative art that responds to your music with beautiful fall colors">
<meta property="og:image" content="https://your-url.com/preview.jpg">
<meta property="og:url" content="https://your-url.com">
<meta name="twitter:card" content="summary_large_image">
```

## Updating Your Deployment

### Netlify/Vercel (with GitHub):
- Just push to your main branch
- Automatic deployment!

### Manual Updates:
1. Make your changes
2. Run `npm run build`
3. Upload the new `dist` folder
4. Or run `npm run deploy` (for gh-pages)

## Need Help?

All these platforms have excellent documentation:
- Netlify Docs: https://docs.netlify.com
- Vercel Docs: https://vercel.com/docs
- GitHub Pages: https://pages.github.com
- Cloudflare Pages: https://developers.cloudflare.com/pages

## Pro Tips

1. **Test locally first:** Run `npm run preview` to test the production build
2. **Mobile testing:** Most hosting services provide preview URLs for testing
3. **Performance:** The site is optimized and should load fast on all these platforms
4. **HTTPS:** All recommended platforms provide free SSL certificates

Happy deploying! 🎨🍂
