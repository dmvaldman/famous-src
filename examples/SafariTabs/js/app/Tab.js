define(function (require, exports, module) {
    var Samsara = require('samsara');
    var View = Samsara.View;
    var Surface = Samsara.Surface;
    var Transform = Samsara.Transform;

    // Represents a tab with title bar, image of the website and eventing
    // logic to close and select a tab.

    // The `Tab` emits `close` and `select` events. Closing a tab removes
    // it from the `Scrollview`, and selecting a tab toggles a fullscreen mode.
    var Tab = View.extend({
        defaults: {
            src: '',
            title: '',
            titleHeightRatio: 0.06
        },
        initialize: function (options) {
            // Create the title bar
            this.title = new Surface({
                proportions : [1, options.titleHeightRatio],
                content: options.title,
                classes: ['title']
            });

            // Create the `close` button
            this.close = new Surface({
                proportions : [1, options.titleHeightRatio],
                size: [40, false],
                content: '×',
                classes: ['close']
            });

            // On `click` emit a `close` event that the `TabContainer` will respond to
            this.close.on('click', function () {
                this.emit('close');
            }.bind(this));

            // Create the tab from an image
            this.content = new Surface({
                proportions : [1, 1 - options.titleHeightRatio],
                classes : ['tab'],
                origin : [0,1],
                attributes : {src : options.src},
                tagName : 'img'
            });

            // On `click` emit a `select` event that the `TabContainer` will respond to
            this.content.on('click', function(){
                this.emit('select');
            }.bind(this));

            // Build the render sub tree, aligning the content to the bottom
            this.add(this.title);
            this.add(this.close);
            this.add({align : [0,1]}).add(this.content);
        },
        // Remove the tab. This will remove the DOM content for later reuse.
        // Note: this API is currently experimental and will be fleshed out in a later version.
        remove : function(){
            this.content.remove();
            this.title.remove();
            this.close.remove();
        }
    });

    module.exports = Tab;
});
