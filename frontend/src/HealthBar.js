class HealthBar {
    
    constructor(container) {
        this.container = container;
        this.life = 100;
    }

    createElement() {
        this.element = document.createElement('progress');
        this.element.setAttribute("id", "health");
        this.element.setAttribute("value", this.life);
        this.element.setAttribute("max", 100);
    }

    update(val) {
        this.life = val;
        this.element.setAttribute("value", this.life);
    }

    init() {
        this.createElement();
        this.container.appendChild(this.element);
    }

}