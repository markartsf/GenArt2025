class Node {
    constructor(type, i, ang) {
        this.pos  = createVector(0, 0);
        // Elliptical start position — uses width for x, height for y
        this.tpos = createVector(cos(ang) * width / 2.2, sin(ang) * height / 2.2);
        this.type = type;
        this.i    = i;
        this.col  = color(colors[i]);
        this.ang  = ang;
        this.counter = map(i, 0, colors.length - 1, 0, TAU);
    }

    show() {
        this.pos.lerp(this.tpos, 0.1);
        push();
        translate(this.pos);
        noStroke();
        fill(this.col);
        // Dot size pulses with amplitude — very obvious beat response
        let dotSize = (height / 72) * (1 + audioScale * 3);
        ellipse(0, 0, dotSize);
        pop();
    }

    arrange() {
        // audioScale (amplitude) → orbit radius expansion
        // audioSpeed (mids)      → orbit speed
        let orbitScale = 1 + audioScale * 4;       // up to 5× base orbit radius
        let speedMult  = 1 + audioSpeed * 5;       // up to 6× base speed

        if (nodes.length == 32 && moving)
            this.counter += 0.02 * speedMult;

        switch (mode) {
            case 0:
                // Elliptical ring — fills landscape frame
                this.tpos.x = cos(this.ang) * (width  / 2.5) + (height / 30) * orbitScale * cos(freq * this.counter);
                this.tpos.y = sin(this.ang) * (height / 2.5) + (height / 30) * orbitScale * sin(freq * this.counter);
                break;
            case 1:
                // Two concentric ellipses
                this.tpos.x = cos(this.ang) * (width  / 2.5 - width  / 5 * this.type) + height / 30 * orbitScale * cos(freq * this.counter);
                this.tpos.y = sin(this.ang) * (height / 2.5 - height / 5 * this.type) + height / 30 * orbitScale * sin(freq * this.counter);
                break;
            case 2:
                this.tpos.x = (-0.35 * width + this.type * 0.7 * width) + (-1 + 2 * this.type) * (height / 24) * orbitScale * cos(freq * this.counter);
                this.tpos.y = map(this.i, 0, colors.length - 1, -0.35 * height, 0.35 * height) - (this.type * height / 32) + (height / 36) * orbitScale * sin(freq * this.counter);
                break;
            case 3:
                this.tpos.x = map(this.i, 0, colors.length, -0.4 * width, 0.4 * width) + (height / 20) * orbitScale * cos(freq * this.counter);
                this.tpos.y = map(this.i, 0, colors.length, -0.4 * height, 0.4 * height) + (height / 20) * orbitScale * sin(freq * this.counter);
                break;
            case 4:
                this.tpos.x = random(-0.4 * width,  0.4 * width)  + (height / 12) * orbitScale * cos(freq * this.counter);
                this.tpos.y = random(-0.35 * height, 0.35 * height) + (height / 12) * orbitScale * sin(freq * this.counter);
                break;
        }
    }

    connect() {
        // Treble thickens connection lines
        strokeWeight(map(audioTreble, 0, 1, 0.5, 6));
        noFill();
        if (this.type == 1) return;
        for (let other of nodes) {
            stroke(lerpColor(this.col, other.col, 0.5));
            if (this.type == other.type) continue;
            switch (mode) {
                case 0:
                    curve(cos(this.ang)*1.5*width, sin(this.ang)*1.5*height, this.pos.x, this.pos.y, other.pos.x, other.pos.y, cos(other.ang)*1.5*width, sin(other.ang)*1.5*height);
                    break;
                case 1:
                    curve(cos(this.ang)*2*width, sin(this.ang)*2*height, this.pos.x, this.pos.y, other.pos.x, other.pos.y, -cos(other.ang)*2*width, -sin(other.ang)*2*height);
                    break;
                case 2:
                    curve(this.pos.x-2*width, this.pos.y-5*(this.pos.y-other.pos.y), this.pos.x, this.pos.y, other.pos.x, other.pos.y, other.pos.x+2*width, other.pos.y+5*(this.pos.y-other.pos.y));
                    break;
                case 3:
                    curve(this.pos.x-3*(this.pos.x-other.pos.x), this.pos.y+5*(this.pos.y-other.pos.y), this.pos.x, this.pos.y, other.pos.x, other.pos.y, other.pos.x+3*(this.pos.x-other.pos.x), other.pos.y-5*(this.pos.y-other.pos.y));
                    break;
                case 4:
                    curve(this.pos.x-2*(this.pos.x-other.pos.x), this.pos.y+5*(this.pos.y-other.pos.y), this.pos.x, this.pos.y, other.pos.x, other.pos.y, other.pos.x+2*(this.pos.x-other.pos.x), other.pos.y-5*(this.pos.y-other.pos.y));
                    break;
            }
        }
    }
}
