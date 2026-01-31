class StarMap {
    constructor() {
        this.data = {};
        this.currentMap = null;
        this.selectedCoords = null;
        this.zoomScale = 1.8;
        this.animationInterval = null;
        
        this.form = document.getElementById('inputForm');
        this.mapContainer = document.getElementById('map');
        this.loadingOverlay = document.querySelector('.loading-overlay');
        this.locationInfo = document.getElementById('locationInfo');
        
        this.customColors = {
            constellations: 'rgba(255, 255, 255, 0.6)',
            dsos: '#6c5ce7',
            background: '#0a0b17',
            planets: '#FFD700',
            graticule: 'rgba(255, 255, 255, 0.2)'
        };
        this.starAppearance = {
            brightness: 1,
            sizeScale: 1.5
        };
        this.labelLanguage = 'default';

        this.debouncedHandleSubmit = this.debounce(() => this.handleSubmit(), 300);
        
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
        this.setDefaultDateTime();
        await this.loadData();
        this.initLocationPicker();
        this.setupEventListeners();
        this.initColorPickers();
        this.setupDownloadModal();
        this.handleSubmit();
    }
    
    setDefaultDateTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        document.getElementById('date').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    initLocationPicker() {
        this.locationMap = L.map('locationPicker').setView([20, 0], 2);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.locationMap);

        L.Control.geocoder({
            defaultMarkGeocode: false
        }).on('markgeocode', (e) => {
            const { lat, lng } = e.geocode.center;
            this.locationMap.setView([lat, lng], 8);
            this.updateLocationMarker(lat, lng);
            this.debouncedHandleSubmit();
        }).addTo(this.locationMap);

        this.locationMarker = null;
        this.locationMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            this.updateLocationMarker(lat, lng);
            this.debouncedHandleSubmit();
        });
        
        this.updateLocationMarker(30.0444, 31.2357);
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
                constellations: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json',
                lines: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json',
                stars: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json',
                dsos: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/dsos.bright.json',
                starnames: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/starnames.json',
                planets: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/planets.json',
                mw: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/mw.json',
                constellationBorders: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.borders.json',
                dsonames: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/dsonames.json'
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
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        document.getElementById('date').addEventListener('input', this.debouncedHandleSubmit);
        document.querySelectorAll('.toggle-group input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('input', this.debouncedHandleSubmit);
        });
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
        
        document.getElementById('labelLanguage').addEventListener('change', (e) => {
            this.labelLanguage = e.target.value;
            this.debouncedHandleSubmit();
        });

        const dateInput = document.getElementById('date');
        const dateLabel = document.querySelector('label[for="date"]');
        if (dateLabel && dateInput) {
            dateLabel.addEventListener('click', () => {
                try {
                    dateInput.showPicker();
                } catch (error) {
                    console.error("showPicker() is not supported by this browser.", error);
                }
            });
        }
        
        document.getElementById('whatUpTonightBtn').addEventListener('click', () => this.setWhatUpTonight());
        
        document.getElementById('playAnimationBtn').addEventListener('click', () => this.startAnimation());
        document.getElementById('pauseAnimationBtn').addEventListener('click', () => this.stopAnimation());
    }

    initColorPickers() {
        const container = document.querySelector('.color-pickers');
        if (!container) return;
    
        const createPicker = (label, targetColor) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'picker-wrapper';
            wrapper.innerHTML = `<label>${label}</label>`;
            const pickerEl = document.createElement('div');
            wrapper.appendChild(pickerEl);
            container.appendChild(wrapper);
    
            const pickr = Pickr.create({
                el: pickerEl,
                theme: 'nano',
                default: this.customColors[targetColor],
                components: {
                    preview: true, opacity: true, hue: true,
                    interaction: { input: true, save: true }
                }
            });
    
            pickr.on('save', (color) => {
                this.customColors[targetColor] = color.toRGBA().toString();
                this.debouncedHandleSubmit();
                pickr.hide();
            });
        };
    
        createPicker('Constellations', 'constellations');
        createPicker('DSOs', 'dsos');
        createPicker('Background', 'background');
        createPicker('Grid', 'graticule');
    }

    async handleSubmit(isAnimation = false) {
        if (!this.validateForm()) return;

        try {
            if (!isAnimation) this.toggleLoading(true);
            const date = this.getDateTime();
            const { lat, lon } = this.selectedCoords;
            const projection = this.createProjection(lat, lon, date);

            this.clearMap();
            if (this.form.graticule.checked) this.renderGraticule(projection);
            if (this.form.milkyWay.checked) this.renderMilkyWay(projection);
            this.renderStars(projection);
            if (this.form.constellations.checked) this.renderConstellations(projection);
            if (this.form.constellationBorders.checked) this.renderConstellationBorders(projection);
            if (this.form.labels.checked) this.renderLabels(projection);
            if (this.form.dsos.checked) this.renderDSOs(projection);
            if (this.form.planets.checked) this.renderPlanets(projection, date);

            this.updateLocationInfo(lat, lon, date);
            document.getElementById('downloadBtn').classList.remove('hidden');

        } catch (error) {
            console.error("Error during map generation:", error);
            this.showError(error.message);
        } finally {
            if (!isAnimation) this.toggleLoading(false);
        }
    }
    
    validateForm() {
        if (!this.selectedCoords) {
            this.showError('Please select a location on the map.', 'locationError');
            return false;
        }
        if (!document.getElementById('date').value) {
            this.showError('Please select a date and time.', 'dateError');
            return false;
        }
        return true;
    }
    
    getDateTime() {
        const dateStr = document.getElementById('date').value;
        const date = new Date(dateStr);
        if (isNaN(date)) throw new Error('Invalid date format.');
        return date;
    }

    createProjection(lat, lon, date) {
        const width = this.mapContainer.clientWidth;
        const height = this.mapContainer.clientHeight;
        const radius = Math.min(width, height) / 2;
        
        const jd = this.dateToJD(date);
        const GST_deg = this.jdToGST(jd);
        let LST_deg = (GST_deg + lon) % 360;
        if (LST_deg < 0) LST_deg += 360;

        return d3.geoStereographic()
            .rotate([-LST_deg, -lat, 0])
            .scale(radius * this.zoomScale)
            .clipAngle(90)
            .translate([0, 0]);
    }

    clearMap() {
        d3.select(this.mapContainer).select('svg').remove();

        const width = this.mapContainer.clientWidth;
        const height = this.mapContainer.clientHeight;
        const radius = Math.min(width, height) / 2;

        const svg = d3.select(this.mapContainer)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .style('background', this.customColors.background);

        svg.append('defs')
            .append('clipPath')
            .attr('id', 'circle-clip')
            .append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', radius);

        this.currentMap = svg.append('g')
            .attr('clip-path', 'url(#circle-clip)')
            .attr('transform', `translate(${width / 2}, ${height / 2})`);
    }

    renderMilkyWay(projection) {
        if (!this.data.mw) return;
        const path = d3.geoPath(projection);
        this.currentMap.append("path")
            .datum(this.data.mw)
            .attr("d", path)
            .attr("class", "milky-way");
    }

    renderConstellationBorders(projection) {
        if (!this.data.constellationBorders) return;
        const path = d3.geoPath(projection);
        this.currentMap.append("path")
            .datum(this.data.constellationBorders)
            .attr("d", path)
            .attr("class", "constellation-border");
    }

    renderGraticule(projection) {
        if (!d3.geoGraticule) return;
        const graticule = d3.geoGraticule().step([15, 10]);
        const path = d3.geoPath(projection);

        this.currentMap.append("path")
            .datum(graticule)
            .attr("d", path)
            .style("fill", "none")
            .style("stroke", this.customColors.graticule)
            .style("stroke-width", 0.5);
    }

    renderStars(projection) {
        if (!this.data.stars || !this.data.stars.features) return;
        this.data.stars.features.forEach(star => {
            const coords = star.geometry?.coordinates;
            if (!coords) return;
            const [x, y] = projection(coords);
            if (!x || !y) return;

            const magnitude = star.properties.mag;
            const size = Math.max(0.5, (3.5 - magnitude/2) * this.starAppearance.sizeScale);
            const color = d3.color(this.getStarColor(star.properties.bv || 0))
                .brighter(this.starAppearance.brightness - 1);

            this.currentMap.append('circle')
                .attr('cx', x).attr('cy', y).attr('r', size)
                .style('fill', color).style('opacity', 0.9)
                .on('mouseover', (e) => this.showStarTooltip(e, star))
                .on('mouseout', () => this.hideTooltip());
        });
    }

    renderConstellations(projection) {
        if (!this.data.lines || !this.data.lines.features) return;
        const path = d3.geoPath(projection);
        this.data.lines.features.forEach(lineFeature => {
            this.currentMap.append("path")
                .datum(lineFeature)
                .attr("d", path)
                .style('stroke', this.customColors.constellations)
                .style('stroke-width', 1)
                .style('fill', 'none')
                .style('opacity', 0.8);
        });
    }

    renderLabels(projection) {
        if (!this.data.constellations || !this.data.constellations.features) return;
        this.data.constellations.features.forEach(constellation => {
            const coords = constellation.properties.display;
            const [x, y] = projection(coords);
            if (!x || !y) return;
    
            let labelText;
            switch (this.labelLanguage) {
                case 'en':
                    labelText = constellation.properties.name;
                    break;
                case 'ar':
                    labelText = constellation.properties.ar;
                    break;
                case 'es':
                    labelText = constellation.properties.es;
                    break;
                case 'de':
                    labelText = constellation.properties.de;
                    break;
                case 'fr':
                    labelText = constellation.properties.fr;
                    break;
                default:
                    labelText = constellation.properties.desig;
            }
            
            this.currentMap.append('text')
                .attr('x', x).attr('y', y).attr('text-anchor', 'middle')
                .style('fill', this.customColors.constellations)
                .style('font-size', '12px').style('opacity', 0.7)
                .text(labelText || constellation.properties.desig);
        });
    }

    renderDSOs(projection) {
        if (!this.data.dsos || !this.data.dsos.features) return;
        this.data.dsos.features.forEach(dso => {
            const coords = dso.geometry?.coordinates;
            if (!coords) return;
            const [x, y] = projection(coords);
            if (!x || !y) return;

            this.currentMap.append('circle')
                .attr('cx', x).attr('cy', y).attr('r', 3)
                .style('fill', this.customColors.dsos).style('opacity', 0.8)
                .on('mouseover', (e) => this.showDSOTooltip(e, dso))
                .on('mouseout', () => this.hideTooltip());
        });
    }

    renderPlanets(projection, date) {
        if (!this.data.planets || !this.data.planets.features) return;
        const getPlanetPosition = (planetName, jd) => {
            const dayOfYear = (jd - 2451545.0) % 365.25;
            const positions = {
                "Mars": { ra: (dayOfYear * 0.5) % 360, dec: 15 },
                "Jupiter": { ra: (dayOfYear * 0.08) % 360, dec: 5 },
                "Saturn": { ra: (dayOfYear * 0.03) % 360, dec: 0 }
            };
            return positions[planetName] || { ra: 0, dec: 0 };
        };

        const jd = this.dateToJD(date);

        this.data.planets.features.forEach(planet => {
            if (!["Mars", "Jupiter", "Saturn"].includes(planet.properties.name)) return;
            const { ra, dec } = getPlanetPosition(planet.properties.name, jd);
            const [x, y] = projection([ra, dec]);
            if (!x || !y) return;

            this.currentMap.append('circle')
                .attr('cx', x).attr('cy', y).attr('r', 5)
                .style('fill', this.customColors.planets)
                .on('mouseover', (e) => this.showPlanetTooltip(e, planet.properties))
                .on('mouseout', () => this.hideTooltip());
        });
    }

    setWhatUpTonight() {
        if (!navigator.geolocation) {
            this.showError("Geolocation is not supported by your browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.updateLocationMarker(latitude, longitude);
                this.locationMap.setView([latitude, longitude], 8);
                this.setDefaultDateTime();
                this.handleSubmit();
            },
            () => {
                this.showError("Unable to retrieve your location. Please select one manually.");
            }
        );
    }

    startAnimation() {
        if (this.animationInterval) return;

        document.getElementById('playAnimationBtn').disabled = true;
        document.getElementById('pauseAnimationBtn').disabled = false;

        const timeStep = document.getElementById('timeStep').value;
        
        this.animationInterval = setInterval(() => {
            const dateInput = document.getElementById('date');
            let currentDate = new Date(dateInput.value);

            switch (timeStep) {
                case 'minute':
                    currentDate.setMinutes(currentDate.getMinutes() + 1);
                    break;
                case 'hour':
                    currentDate.setHours(currentDate.getHours() + 1);
                    break;
                case 'day':
                    currentDate.setDate(currentDate.getDate() + 1);
                    break;
            }
            
            const year = currentDate.getFullYear();
            const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            const day = currentDate.getDate().toString().padStart(2, '0');
            const hours = currentDate.getHours().toString().padStart(2, '0');
            const minutes = currentDate.getMinutes().toString().padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;

            this.handleSubmit(true);
        }, 100);
    }

    stopAnimation() {
        clearInterval(this.animationInterval);
        this.animationInterval = null;
        document.getElementById('playAnimationBtn').disabled = false;
        document.getElementById('pauseAnimationBtn').disabled = true;
    }

    getStarColor(bv) {
        const t = 4600 * ((1 / (0.92 * bv + 1.7)) + (1 / (0.92 * bv + 0.62)));
        if (t < 3000) return '#ffcc99';
        if (t < 5000) return '#ffddae';
        if (t < 6000) return '#ffffd4';
        if (t < 8000) return '#ffffff';
        return '#cad8ff';
    }

    updateLocationInfo(lat, lon, date) {
        document.getElementById('lat').textContent = lat.toFixed(4);
        document.getElementById('lon').textContent = lon.toFixed(4);
        const LST_hours = (this.jdToLST(this.dateToJD(date), lon) / 15);
        document.getElementById('lst').textContent = `${LST_hours.toFixed(2)}h`;
        this.locationInfo.classList.remove('hidden');
    }

    dateToJD(date) { return date.getTime() / 86400000 + 2440587.5; }

    jdToGST(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        let GST = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000.0;
        return (GST % 360 + 360) % 360;
    }
    
    jdToLST(jd, lon) {
        const gst = this.jdToGST(jd);
        let lst = gst + lon;
        return (lst % 360 + 360) % 360;
    }

    toggleLoading(show) {
        this.loadingOverlay.classList.toggle('hidden', !show);
        document.querySelector('.generate-btn .btn-text').style.visibility = show ? 'hidden' : 'visible';
        document.querySelector('.generate-btn .spinner').classList.toggle('hidden', !show);
    }

    showError(message, elementId = null) {
        if (elementId) {
            document.getElementById(elementId).textContent = message;
        } else {
            const errorEl = document.getElementById('locationError');
            if (errorEl) errorEl.textContent = message;
        }
    }

    setupDownloadModal() {
        const modal = document.getElementById('downloadModal');
        const btn = document.getElementById('downloadBtn');
        const closeSpan = document.querySelector('.close-modal');
        const finalBtn = document.getElementById('finalDownloadBtn');
        const templates = document.querySelectorAll('.template-option');
        
        const titleInput = document.getElementById('mapTitle');
        const dateInput = document.getElementById('mapDateLabel');
        const fontInput = document.getElementById('templateFont');
        const bgInput = document.getElementById('templateBgColor');
        const textInput = document.getElementById('templateTextColor');

        this.currentTemplate = 'clean';

        btn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            const dateVal = document.getElementById('date').value;
            const dateObj = new Date(dateVal);
            dateInput.value = dateObj.toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            this.updatePreview();
        });

        closeSpan.addEventListener('click', () => modal.classList.add('hidden'));
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });

        templates.forEach(t => {
            t.addEventListener('click', (e) => {
                templates.forEach(opt => opt.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentTemplate = e.currentTarget.dataset.template;

                if (this.currentTemplate === 'polaroid') {
                    bgInput.value = '#ffffff';
                    textInput.value = '#000000';
                } else if (this.currentTemplate === 'poster') {
                    bgInput.value = '#0a0b17';
                    textInput.value = '#ffffff';
                }
                
                this.updatePreview();
            });
        });

        [titleInput, dateInput, fontInput, bgInput, textInput].forEach(el => {
            el.addEventListener('input', () => this.debouncedUpdatePreview());
        });

        finalBtn.addEventListener('click', () => this.downloadFinalImage());

        this.debouncedUpdatePreview = this.debounce(() => this.updatePreview(), 50);
    }
    
    updatePreview() {
        const container = document.getElementById('canvasPreviewContainer');
        container.innerHTML = '';
        const title = document.getElementById('mapTitle').value;
        const subtitle = document.getElementById('mapDateLabel').value;
        const coords = document.getElementById('selectedLocation').textContent;
        const font = document.getElementById('templateFont').value;
        const bgColor = document.getElementById('templateBgColor').value;
        const textColor = document.getElementById('templateTextColor').value;
        const svgElement = this.mapContainer.querySelector('svg');
        const { width, height } = svgElement.getBoundingClientRect();
        const mapDiameter = Math.min(width, height);
        const clonedSvg = svgElement.cloneNode(true);
        clonedSvg.setAttribute('width', width);
        clonedSvg.setAttribute('height', height);
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const scale = 2;
        const baseDiameter = mapDiameter * scale;

        let finalWidth, finalHeight, mapCenterX, mapCenterY, mapRadius;
        if (this.currentTemplate === 'polaroid') {
            finalWidth = baseDiameter * 1.2;
            finalHeight = baseDiameter * 1.5;
            mapRadius = baseDiameter / 2;
            mapCenterX = finalWidth / 2;
            mapCenterY = finalWidth / 2;
        } else if (this.currentTemplate === 'poster') {
            finalWidth = baseDiameter * 1.2;
            finalHeight = baseDiameter * 1.6;
            mapRadius = baseDiameter / 2;
            mapCenterX = finalWidth / 2;
            mapCenterY = finalHeight * 0.4;
        } else {
            finalWidth = baseDiameter;
            finalHeight = baseDiameter;
            mapRadius = baseDiameter / 2;
            mapCenterX = finalWidth / 2;
            mapCenterY = finalHeight / 2;
        }

        const canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');

        if (this.currentTemplate !== 'clean') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, finalWidth, finalHeight);
        }

        const img = new Image();
        img.onload = () => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(mapCenterX, mapCenterY, mapRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            ctx.fillStyle = this.customColors.background;
            ctx.fillRect(mapCenterX - mapRadius, mapCenterY - mapRadius, mapRadius * 2, mapRadius * 2);

            const sX = (width - mapDiameter) / 2;
            const sY = (height - mapDiameter) / 2;
            
            ctx.drawImage(img, sX, sY, mapDiameter, mapDiameter,
                mapCenterX - mapRadius, mapCenterY - mapRadius, mapRadius * 2, mapRadius * 2);
            ctx.restore();

            if (this.currentTemplate !== 'clean') {
                ctx.textAlign = 'center';
                ctx.fillStyle = textColor;

                if (this.currentTemplate === 'polaroid') {
                    const textStartY = mapCenterY + mapRadius + (finalHeight * 0.05);
                    
                    ctx.font = `bold ${baseDiameter * 0.06}px ${font}`;
                    ctx.fillText(title || "THE NIGHT SKY", mapCenterX, textStartY + (baseDiameter * 0.05));
                    
                    ctx.fillStyle = this.adjustColorOpacity(textColor, 0.7);
                    ctx.font = `${baseDiameter * 0.035}px ${font}`;
                    ctx.fillText(subtitle, mapCenterX, textStartY + (baseDiameter * 0.1));
                    ctx.fillText(coords, mapCenterX, textStartY + (baseDiameter * 0.14));

                } else if (this.currentTemplate === 'poster') {
                    ctx.font = `300 ${baseDiameter * 0.1}px ${font}`;
                    if (font.includes('Montserrat')) ctx.letterSpacing = '5px';
                    
                    ctx.fillText((title || "STARS").toUpperCase(), mapCenterX, finalHeight * 0.75);
                    
                    ctx.beginPath();
                    ctx.moveTo(mapCenterX - 50, finalHeight * 0.78);
                    ctx.lineTo(mapCenterX + 50, finalHeight * 0.78);
                    ctx.strokeStyle = this.adjustColorOpacity(textColor, 0.5);
                    ctx.stroke();

                    ctx.letterSpacing = '0px';
                    ctx.font = `${baseDiameter * 0.03}px ${font}`;
                    ctx.fillStyle = this.adjustColorOpacity(textColor, 0.8);
                    ctx.fillText(subtitle, mapCenterX, finalHeight * 0.82);
                    ctx.fillText(coords, mapCenterX, finalHeight * 0.85);
                }
            }

            container.appendChild(canvas);
            this.previewCanvas = canvas;
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    }
    
    adjustColorOpacity(hex, opacity) {
        let c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c= hex.substring(1).split('');
            if(c.length== 3){
                c= [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c= '0x'+c.join('');
            return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+opacity+')';
        }
        return hex;
    }

    downloadFinalImage() {
        if (!this.previewCanvas) return;
        
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0,10);
        link.download = `starmap-${this.currentTemplate}-${timestamp}.png`;
        link.href = this.previewCanvas.toDataURL('image/png');
        link.click();
    }

    hideTooltip() { document.querySelectorAll('.tooltip').forEach(t => t.remove()); }

    showStarTooltip(event, star) {
        const name = this.data.starnames[star.properties.hip]?.proper || star.properties.desig;
        const content = `<strong>${name}</strong><br>Magnitude: ${star.properties.mag.toFixed(2)}<br>Constellation: ${star.properties.con}`;
        this.createTooltip(event, content);
    }

    showDSOTooltip(event, dso) {
        const props = dso.properties;
        const commonName = this.data.dsonames[props.id]?.name || '';
        const nameDisplay = commonName ? `<strong>${commonName}</strong><br>(${props.id})` : `<strong>${props.id}</strong>`;
        const content = `${nameDisplay}<br>Type: ${props.type}<br>Magnitude: ${props.mag ? props.mag.toFixed(2) : 'N/A'}`;
        this.createTooltip(event, content);
    }
    
    showPlanetTooltip(event, planet) {
        const content = `<strong>${planet.name}</strong><br>Type: Planet`;
        this.createTooltip(event, content);
    }

    createTooltip(event, content) {
        this.hideTooltip();
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.style.left = `${event.pageX + 15}px`;
        tooltip.style.top = `${event.pageY + 15}px`;
        tooltip.innerHTML = content;
        document.body.appendChild(tooltip);
    }
}

window.addEventListener('load', () => { new StarMap(); });