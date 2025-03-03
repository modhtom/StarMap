class StarMap {
    constructor() {
        this.data = {};
        this.currentMap = null;
        this.form = document.getElementById('inputForm');
        this.mapContainer = document.getElementById('map');
        this.loadingOverlay = document.querySelector('.loading-overlay');
        this.locationInfo = document.getElementById('locationInfo');
        this.selectedCoords = null;
        this.customColors = {
            stars: '#ffffff',
            constellations: 'rgba(255, 255, 255, 0.6)',
            dsos: '#6c5ce7',
            background: '#0a0b17'
        };
        this.starAppearance = {
            brightness: 1,
            sizeScale: 1.5
        };
        this.currentViewMode = 'equatorial';
        this.debouncedHandleSubmit = this.debounce(() => this.handleSubmit(), 300);
        this.zoomScale=1.8;
        this.init();
    }
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    async init() {
        await this.loadData();
        this.initLocationPicker();
        this.setupEventListeners();
    }

    initLocationPicker() {
        this.locationMap = L.map('locationPicker').setView([20, 0], 2);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.locationMap);

        this.locationMarker = null;
        this.locationMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            this.updateLocationMarker(lat, lng);
        });
    }

    updateLocationMarker(lat, lng) {
        if (this.locationMarker) {
            this.locationMap.removeLayer(this.locationMarker);
        }
        this.locationMarker = L.marker([lat, lng]).addTo(this.locationMap);
        this.selectedCoords = { lat, lon: lng };
        document.getElementById('selectedLocation').textContent = 
            `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    }

    async loadData() {
        try {
            const dataUrls = {
                constellations: 'DATA/constellations.json',
                lines: 'DATA/constellations.lines.json',
                stars: 'DATA/stars.6.json',
                dsos: 'DATA/dsos.bright.json',
                starnames: 'DATA/starnames.json',
                planets: 'DATA/planets.json'
            };

            const dataPromises = Object.entries(dataUrls).map(([key, url]) =>
                fetch(url).then(r => r.json()).then(d => [key, d])
            );

            this.data = Object.fromEntries(await Promise.all(dataPromises));
        } catch (error) {
            this.showError('Failed to load star data. Please try refreshing.');
        }
    }

    setupEventListeners() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit();
        });

        document.getElementById('date').addEventListener('input', this.validateDate);
        
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.addEventListener('click', () => this.downloadImage());

        document.getElementById('starBrightness').addEventListener('input', (e) => {
            this.starAppearance.brightness = parseFloat(e.target.value);
            this.debouncedHandleSubmit();
        });
        document.getElementById('starSize').addEventListener('input', (e) => {
            this.starAppearance.sizeScale = parseFloat(e.target.value);
            this.debouncedHandleSubmit();
        });
        document.getElementById('zoomScale').addEventListener('input', (e) => {
            this.zoomScale = parseFloat(e.target.value);
            this.debouncedHandleSubmit();
        });
    }

    async handleSubmit() {
        if (!this.validateForm()) return;

        try {
            this.toggleLoading(true);
            const date = this.getDateTime();
            const { lat, lon } = this.selectedCoords;
            const projection = this.createProjection(lat, lon, date);

            this.clearMap();
            this.renderStars(projection);
            if (this.form.constellations.checked) this.renderConstellations(projection);
            if (this.form.labels.checked) this.renderLabels(projection);
            if (this.form.dsos.checked) this.renderDSOs(projection);

            this.updateLocationInfo(lat, lon, date);

            document.getElementById('downloadBtn').classList.remove('hidden');

        } catch (error) {
            this.showError(error.message);
        } finally {
            this.toggleLoading(false);
        }
    }

    validateForm() {
        if (!this.selectedCoords) {
            this.showError('Please select a location on the map.', 'locationError');
            return false;
        }

        const date = document.getElementById('date').value;
        if (!date) {
            this.showError('Please select a date and time.', 'dateError');
            return false;
        }

        return true;
    }

    async getCoordinates() {
        const city = document.getElementById('city').value.trim();
    
        if (this.selectedCoords) {
            return this.selectedCoords;
        } else {
            throw new Error('No location selected on the map. Please select a location.');
        }
    }
    
    getDateTime() {
        const dateStr = document.getElementById('date').value;
        const date = new Date(dateStr + 'Z');
        if (isNaN(date)) throw new Error('Invalid date format.');
        return date;
    }

    createProjection(lat, lon, date) {
        const width = this.mapContainer.clientWidth;
        const height = this.mapContainer.clientHeight;
        const radius = Math.min(width, height) / 2;
        
        if (this.currentViewMode === 'azimuthal') {
            return d3.geoAzimuthalEquidistant()
                .rotate([-lon, -lat])
                .scale(Math.min(width, height) / 2 / Math.PI)
                .translate([0, 0]);
        } else {

            const jd = this.dateToJD(date);
            const GST_deg = this.jdToGST(jd);
            let LST_deg = (GST_deg + lon) % 360;
            if (LST_deg < 0) LST_deg += 360;

            return (ra, dec) => {
                let deltaRA = ra - LST_deg;
                deltaRA = ((deltaRA % 360) + 360) % 360;
                if (deltaRA > 180) deltaRA -= 360;
                const λ = deltaRA * Math.PI / 180;
                const φ = dec * Math.PI / 180;
                const φ0 = lat * Math.PI / 180;

                const scale = this.zoomScale;
                const denominator = 1 + Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ);
                if (denominator <= 0) return [NaN, NaN];

                const k = scale * radius / denominator;
                const x = k * Math.cos(φ) * Math.sin(λ);
                const y = k * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ));
                return [x, -y];
            }
        };
    }

    clearMap() {
        const svg = d3.select(this.mapContainer).select('svg');
        if (!svg.empty()) svg.remove();

        this.currentMap = d3.select(this.mapContainer)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .style('background', '#1a1b26');

        this.currentMap.append('defs')
            .append('clipPath')
            .attr('id', 'circle-clip')
            .append('circle')
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '50%');

        this.currentMap.append('circle')
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '50%')
            .style('fill', this.customColors.background);

        this.currentMap = this.currentMap.append('g')
            .attr('clip-path', 'url(#circle-clip)')
            .attr('transform', 'translate(50%, 50%)');
    }

    renderStars(projection) {
        this.data.stars.features.forEach(star => {
            const coords = star.geometry?.coordinates;
            if (!coords) return;
            const [x, y] = projection(coords[0], coords[1]);
            if (isNaN(x) || isNaN(y)) return;

            const magnitude = star.properties.mag;
            const size = Math.max(0.5, (3.5 - magnitude/2) * this.starAppearance.sizeScale);
            const color = d3.color(this.getStarColor(star.properties.bv || 0))
                .brighter(this.starAppearance.brightness - 1);

            this.currentMap.append('circle')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', size)
                .style('fill', color)
                .style('opacity', 0.8)
                .on('mouseover', (e) => this.showStarTooltip(e, star))
                .on('mouseout', () => this.hideTooltip());
        });
    }
    hideTooltip() {
        const tooltips = document.querySelectorAll('.tooltip');
        tooltips.forEach(t => t.remove());
    }
    getStarColor(bv) {
        const t = 4600 * ((1 / (0.92 * bv + 1.7)) + (1 / (0.92 * bv + 0.62)));
        if (t < 3000) return '#ffcc99';
        if (t < 5000) return '#ffcc00';
        if (t < 6000) return '#ffffcc';
        if (t < 8000) return '#ffffff';
        return '#ccffff';
    }

    renderConstellations(projection) {
        this.data.lines.features.forEach(constellation => {
            constellation.geometry.coordinates.forEach(lines => {
                const path = lines.map(([ra, dec]) => projection(ra, dec));
                this.currentMap.append('path')
                    .datum(path)
                    .attr('d', d3.line().defined(d => !isNaN(d[0]) && !isNaN(d[1])))
                    .style('stroke', d3.color(this.customColors.constellations).brighter(1))
                    .style('stroke-width', 1)
                    .style('fill', 'none')
                    .style('opacity', 0.6);                    
            });
        });
    }

    renderLabels(projection) {
        this.data.constellations.features.forEach(constellation => {
            const [ra, dec] = constellation.properties.display;
            const [x, y] = projection(ra, dec);
            if (isNaN(x) || isNaN(y)) return;
    
            const hipId = constellation.properties.hip;
            const starNameData = this.data.starnames[hipId];
            const labelText = constellation.properties.ar || starNameData?.ar || constellation.properties.desig;
            
            this.currentMap.append('text')
                .attr('x', x)
                .attr('y', y)
                .attr('text-anchor', 'middle')
                .style('fill', 'rgba(255, 255, 255, 0.6)')
                .style('font-size', '12px')
                .text(labelText);
        });
    }

    renderDSOs(projection) {
        this.data.dsos.features.forEach(dso => {
            const coords = dso.geometry?.coordinates;
            if (!coords) return;
            const [x, y] = projection(coords[0], coords[1]);
            if (isNaN(x) || isNaN(y)) return;

            this.currentMap.append('circle')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', 3)
                .style('fill', this.customColors.dsos)
                .style('opacity', 0.8);
        });
    }

    updateLocationInfo(lat, lon, date) {
        document.getElementById('lat').textContent = lat.toFixed(4);
        document.getElementById('lon').textContent = lon.toFixed(4);
        document.getElementById('lst').textContent = this.jdToGST(this.dateToJD(date)).toFixed(2) + '°';
        this.locationInfo.classList.remove('hidden');
    }

    dateToJD(date) {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();
        const milliseconds = date.getUTCMilliseconds();

        const a = Math.floor((14 - month) / 12);
        const y = year + 4800 - a;
        const m = month + 12 * a - 3;

        let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
        jd += (hours - 12) / 24 + minutes / 1440 + seconds / 86400 + milliseconds / 86400000;
        return jd;
    }

    jdToGST(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        let GST = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000.0;
        GST = (GST % 360 + 360) % 360;
        return GST;
    }

    toggleLoading(show) {
        this.loadingOverlay.classList.toggle('hidden', !show);
        document.querySelector('.generate-btn .btn-text').style.visibility = show ? 'hidden' : 'visible';
        document.querySelector('.generate-btn .spinner').classList.toggle('hidden', !show);
    }

    showStarTooltip(event, star) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
        
        const name = this.data.starnames[star.properties.hip]?.proper || star.properties.desig;
        tooltip.innerHTML = `
            <strong>${name}</strong><br>
            Magnitude: ${star.properties.mag.toFixed(2)}<br>
            Constellation: ${star.properties.con}
        `;
        
        document.body.appendChild(tooltip);
    }

    downloadImage() {
        const svgElement = this.mapContainer.querySelector('svg');
        const rect = svgElement.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
    
        if (!svgElement.getAttribute("viewBox")) {
            svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
        }
    
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
    
        const scaleFactor = window.devicePixelRatio || 1;
        canvas.width = width * scaleFactor;
        canvas.height = height * scaleFactor;
        context.scale(scaleFactor, scaleFactor);
    
        const image = new Image();
        image.onload = () => {
            context.fillStyle = this.customColors.background;
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0, width, height);
    
            const a = document.createElement('a');
            a.download = 'star_map.png';
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
    
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    }
    
    
    showError(message, elementId = null) {
        if (elementId) {
            document.getElementById(elementId).textContent = message;
        } else {
            alert(message);
        }
    }
}

new StarMap();