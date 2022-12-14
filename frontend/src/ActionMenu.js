class ActionMenu {

    constructor(config) {
        this.overlay = config.overlay;
        this.options = config.options;
        this.radius = 40;
    }

    alterOptions(options) {
        this.options = options;
        this.setOptions();
    }

    setOptions() {
        this.element.innerHTML = this.options.map((option, index) => {
            return (`
                <div class="option">
                    <button data-button="${index}" class="action-button ${option.class}">
                    </button>
                </div>
            `);
        }).join("");

        this.element.querySelectorAll("button").forEach(button => {
            let index = Number(button.dataset.button);
            button.addEventListener('click', () => {
                const chosenOption = this.options[index];
                chosenOption.handler();
            });
            
            const offsetX = this.radius * Math.sin(Math.PI/2/(this.options.length-1) * index);
            const offsetY = this.radius * Math.cos(Math.PI/2/(this.options.length-1) * index);
            let str = `translate(-${Math.round(offsetX)}vh,-${Math.round(offsetY)}vh)`;
            button.style.transform = str;
        });
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.classList.add('action-menu');
    }

    close() {
        this.element.remove();
    }

    init() {
        this.createElement();
        this.setOptions();
        this.overlay.appendChild(this.element);
    }

}