define(function(require, exports, module) {
    var Samsara = require('samsara');
    var View = Samsara.View;
    var Transform = Samsara.Transform;
    var Surface = Samsara.Surface;
    var ContainerSurface = Samsara.ContainerSurface;

    // A wedge is a angular section of a circle. It's created
    // by placing a circle centered at the lower left corner
    // of a containing `<div>`, shearing the containing `<div>`
    // to the desired angle, and applying the inverse shear to
    // the circle.
    var Wedge = View.extend({
        defaults : {
            angle : 0
        },
        initialize : function(options){
            // Containing surface to apply skew to.
            var skewedContainer = new ContainerSurface({
                classes : ['wedge-container']
            });

            // A circle to apply inverse skew to
            // More accurately, it's an annulus with
            // thickness equal to the border radius.
            var wedge = new Surface({
                origin : [.5,.5],  // place the center of the circle at (0,0)
                classes : ['wedge']
            });

            // When the wedge resizes, change the border proportionally.
            wedge.on('resize', function(size){
                wedge.setProperties({
                    borderWidth : Math.round(size[0]/3) + 'px'
                });
            });

            // Spinning animation mapped from the swivel transitionable.
            // Experiment here! It's fun and you won't break anything.
            var crazySpinningTransform = this.input.map(function(swivel){
                return Transform.composeMany(
                    Transform.rotateZ(   2 * swivel),
                    Transform.rotateX( 1.5 * swivel),
                    Transform.rotateY(  -2 * swivel),
                    Transform.rotateX(-0.5 * swivel)
                );
            });

            // Angle to skew the container and circle.
            var skewAngle = Math.PI/2 - options.angle;

            // Transform for the container
            var skew = Transform.skewX(skewAngle);

            // Transform for the circle.
            var antiSkew = Transform.skewX(-skewAngle);

            // Add the wedge to the container's inner render tree.
            skewedContainer.add({transform : antiSkew}).add(wedge);

            // Add the container to the render tree with an animating layout.
            this.add({transform : skew})
                .add({transform : crazySpinningTransform})
                .add(skewedContainer);
        }
    });

    module.exports = Wedge;
});
