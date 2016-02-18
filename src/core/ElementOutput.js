/* Copyright © 2015-2016 David Valdman */


import EventHandler from '../events/EventHandler.js';
import Transform from './Transform.js';
import Stream from '../streams/Stream.js';
import ResizeStream from '../streams/ResizeStream.js';
import SizeNode from './SizeNode.js';
import LayoutNode from './LayoutNode.js';
import sizeAlgebra from './algebras/size.js';
import layoutAlgebra from './algebras/layout.js';

var usePrefix = !('transform' in document.documentElement.style);
var devicePixelRatio = 2 * (window.devicePixelRatio || 1);
var MIN_OPACITY = 0.0001;
var MAX_OPACITY = 0.9999;
var EPSILON = 1e-5;
var _zeroZero = [0,0];

/**
 * Responsible for committing CSS3 properties to the DOM and providing DOM event hooks
 *  from a provided DOM element. Where Surface's API handles inputs from the developer
 *  from within Samsara, ElementOutput handles the DOM interaction layer.
 *
 *
 * @class ElementOutput
 * @constructor
 * @namespace Core
 * @uses Core.LayoutNode
 * @uses Core.SizeNode
 * @private
 * @param {Node} element document parent of this container
 */
function ElementOutput(element) {
    this._currentTarget = null;

    this._cachedSpec = {
        transform : null,
        opacity : 1,
        origin : null,
        size : null
    };

    this._eventOutput = new EventHandler();
    EventHandler.setOutputHandler(this, this._eventOutput);

    this._eventForwarder = function _eventForwarder(event) {
        this._eventOutput.emit(event.type, event);
    }.bind(this);

    this._sizeNode = new SizeNode();
    this._layoutNode = new LayoutNode();

    this._size = new EventHandler();
    this._layout = new EventHandler();

    this.size = ResizeStream.lift(function elementSizeLift(sizeSpec, parentSize){
        if (!parentSize) return false; // occurs when surface is never added
        return sizeAlgebra(sizeSpec, parentSize);
    }, [this._sizeNode, this._size]);

    this.layout = Stream.lift(function(parentSpec, objectSpec, size){
        if (!parentSpec || !size) return false;
        return (objectSpec)
            ? layoutAlgebra(objectSpec, parentSpec, size)
            : parentSpec;
    }, [this._layout, this._layoutNode, this.size]);

    this.layout.on('start', function(){
        if (!this._currentTarget){
            var root = this._getRoot();
            this.setup(root.allocator);
        }
    }.bind(this));

    this.layout.on('update', commitLayout.bind(this));
    this.layout.on('end', commitLayout.bind(this));

    this.size.on('resize', function(size){
        if (!this._currentTarget){
            var root = this._getRoot();
            this.setup(root.allocator);
        }
        commitSize.call(this, size);
    }.bind(this));

    this._currentTarget = null;

    this._opacityDirty = true;
    this._originDirty = true;
    this._transformDirty = true;
    this._isVisible = true;

    if (element) this.attach(element);
}

function _addEventListeners(target) {
    for (var i in this._eventOutput.listeners)
        target.addEventListener(i, this._eventForwarder);
}

function _removeEventListeners(target) {
    for (var i in this._eventOutput.listeners)
        target.removeEventListener(i, this._eventForwarder);
}

function _round(value, unit){
    return (unit === 1)
        ? Math.round(value)
        : Math.round(value * unit) / unit
}

function _formatCSSTransform(transform, unit) {
    var result = 'matrix3d(';
    for (var i = 0; i < 15; i++) {
        if (Math.abs(transform[i]) < EPSILON) transform[i] = 0;
        result += (i === 12 || i === 13)
            ? _round(transform[i], unit) + ','
            : transform[i] + ',';
    }
    return result + transform[15] + ')';
}

function _formatCSSOrigin(origin) {
    return (100 * origin[0]) + '% ' + (100 * origin[1]) + '%';
}

function _xyNotEquals(a, b) {
    return (a && b) ? (a[0] !== b[0] || a[1] !== b[1]) : a !== b;
}

var _setOrigin = usePrefix
    ? function _setOrigin(element, origin) {
        element.style.webkitTransformOrigin = _formatCSSOrigin(origin);
    }
    : function _setOrigin(element, origin) {
        element.style.transformOrigin = _formatCSSOrigin(origin);
    };

var _setTransform = (usePrefix)
    ? function _setTransform(element, transform, unit) {
        element.style.webkitTransform = _formatCSSTransform(transform, unit);
    }
    : function _setTransform(element, transform, unit) {
        element.style.transform = _formatCSSTransform(transform, unit);
    };

var _setSize = function _setSize(target, size){
    if (size[0] === true) size[0] = target.offsetWidth;
    else target.style.width = size[0] + 'px';

    if (size[1] === true) size[1] = target.offsetHeight;
    else target.style.height = size[1] + 'px';
};

// {Visibility : hidden} allows for DOM events to pass through the element
// TODO: use pointerEvents instead. However, there is a bug in Chrome for Android
// ticket here: https://code.google.com/p/chromium/issues/detail?id=569654
var _setOpacity = function _setOpacity(element, opacity) {
    if (!this._isVisible && opacity > MIN_OPACITY) {
        //element.style.pointerEvents = 'auto';
        element.style.visibility = 'visible';
        this._isVisible = true;
    }

    if (opacity > MAX_OPACITY) opacity = MAX_OPACITY;
    else if (opacity < MIN_OPACITY) {
        opacity = MIN_OPACITY;
        if (this._isVisible) {
            //element.style.pointerEvents = 'none';
            element.style.visibility = 'hidden';
            this._isVisible = false;
        }
    }

    if (this._isVisible) element.style.opacity = opacity;
};

/**
 * Adds a handler to the `type` channel which will be executed on `emit`.
 *
 * @method on
 *
 * @param type {String}         DOM event channel name, e.g., "click", "touchmove"
 * @param handler {Function}    Handler. It's only argument will be an emitted data payload.
 */
ElementOutput.prototype.on = function on(type, handler) {
    if (this._currentTarget)
        this._currentTarget.addEventListener(type, this._eventForwarder);
    EventHandler.prototype.on.apply(this._eventOutput, arguments);
};

/**
 * Removes a previously added handler to the `type` channel.
 *  Undoes the work of `on`.
 *
 * @method removeListener
 * @param type {String}         DOM event channel name e.g., "click", "touchmove"
 * @param handler {Function}    Handler
 */
ElementOutput.prototype.off = function off(type, handler) {
    EventHandler.prototype.off.apply(this._eventOutput, arguments);
};

/**
 * Emit an event with optional data payload. This will execute all listening
 *  to the channel name with the payload as only argument.
 *
 * @method emit
 * @param type {string}         Event channel name
 * @param [payload] {Object}    User defined data payload
 */
ElementOutput.prototype.emit = function emit(type, payload) {
    EventHandler.prototype.emit.apply(this._eventOutput, arguments);
};

/**
 * Assigns the DOM element for committing and to and attaches event listeners.
 *
 * @private
 * @method attach
 * @param {Node} target document parent of this container
 */
ElementOutput.prototype.attach = function attach(target) {
    this._currentTarget = target;
    _addEventListeners.call(this, target);
};

/**
 * Removes the associated DOM element in memory and detached event listeners.
 *
 * @private
 * @method detach
 */
ElementOutput.prototype.detach = function detach() {
    var target = this._currentTarget;
    if (target) {
        _removeEventListeners.call(this, target);
        target.style.display = '';
    }
    this._currentTarget = null;
};

function commitLayout(layout) {
    var target = this._currentTarget;
    if (!target) return;

    var cache = this._cachedSpec;

    var transform = layout.transform || Transform.identity;
    var opacity = (layout.opacity === undefined) ? 1 : layout.opacity;
    var origin = layout.origin || _zeroZero;

    this._transformDirty = Transform.notEquals(cache.transform, transform);
    this._opacityDirty = this._opacityDirty || (cache.opacity !== opacity);
    this._originDirty = this._originDirty || (origin && _xyNotEquals(cache.origin, origin));

    if (this._opacityDirty) {
        cache.opacity = opacity;
        _setOpacity.call(this, target, opacity);
    }

    if (this._originDirty){
        cache.origin = origin;
        _setOrigin(target, origin);
    }

    if (this._transformDirty) {
        cache.transform = transform;
        _setTransform(target, transform, this.roundToPixel ? 1 : devicePixelRatio);
    }

    this._originDirty = false;
    this._transformDirty = false;
    this._opacityDirty = false;
}

function commitSize(size){
    var target = this._currentTarget;
    if (!target) return;

    if (size[0] !== true) size[0] = _round(size[0], devicePixelRatio);
    if (size[1] !== true) size[1] = _round(size[1], devicePixelRatio);

    if (_xyNotEquals(this._cachedSpec.size, size)){
        this._cachedSpec.size = size;
        _setSize(target, size);
        this.emit('resize', size);
    }
}

export default ElementOutput;

