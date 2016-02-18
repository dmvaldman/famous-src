define(function (require, exports, module) {
    var Context = require('samsara').Context;
    var ParallaxCats = require('./app/ParallaxCats');

    // Location of cat images
    var urls = [
        './assets/cat1.jpg',
        './assets/cat2.jpg',
        './assets/cat3.jpg',
        './assets/cat4.jpg',
        './assets/cat5.jpg',
        './assets/cat6.jpg',
        './assets/cat7.jpg'
    ];

    // Create the parallaxCats view with specified options
    var parallaxCats = new ParallaxCats({
        size : [Math.min(400, window.innerWidth), undefined],
        origin: [.5, 0],
        skew : Math.PI / 25,
        parallaxAmount : 70,
        urls : urls
    });

    // Create a Samsara Context as the root of the render tree
    var context = new Context();

    // Add the parallaxCats to the context and center the origin point
    context
        .add({align : [.5,0]})
        .add(parallaxCats);

    // Mount the context to a DOM node
    context.mount(document.body);
});
