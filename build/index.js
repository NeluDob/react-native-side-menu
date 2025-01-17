// @flow
//release

import React from 'react';
import {
    PanResponder,
    View,
    Dimensions,
    Animated,
    TouchableWithoutFeedback,
} from 'react-native';
import PropTypes from 'prop-types';
import styles from './styles';

type WindowDimensions = { width: number, height: number };

type Props = {
    edgeHitWidth: number,
    toleranceX: number,
    toleranceY: number,
    menuPosition: 'left' | 'right',
    onChange: Function,
    onMove: Function,
    onSliding: Function,
    openMenuOffset: number,
    hiddenMenuOffset: number,
    disableGestures: Function | bool,
    animationFunction: Function,
    onStartShouldSetResponderCapture: Function,
    isOpen: bool,
    bounceBackOnOverdraw: bool,
    autoClosing: bool
};

type Event = {
    nativeEvent: {
        layout: {
            width: number,
            height: number,
        },
    },
};

type State = {
    width: number,
    height: number,
    openOffsetMenuPercentage: number,
    openMenuOffset: number,
    hiddenMenuOffsetPercentage: number,
    hiddenMenuOffset: number,
    left: Animated.Value,
};

const deviceScreen: WindowDimensions = Dimensions.get('window');
const barrierForward: number = deviceScreen.width / 4;

function shouldOpenMenu(dx: number): boolean {
    return dx > barrierForward;
}

export default class SideMenu extends React.Component {
    onLayoutChange: Function;
    onStartShouldSetResponderCapture: Function;
    onMoveShouldSetPanResponder: Function;
    onPanResponderMove: Function;
    onPanResponderRelease: Function;
    onPanResponderTerminate: Function;
    state: State;
    prevLeft: number;
    isOpen: boolean;

    constructor(props: Props) {
        super(props);

        this.prevLeft = 0;
        this.isOpen = !!props.isOpen;

        const initialMenuPositionMultiplier = props.menuPosition === 'right' ? -1 : 1;
        const openOffsetMenuPercentage = props.openMenuOffset / deviceScreen.width;
        const hiddenMenuOffsetPercentage = props.hiddenMenuOffset / deviceScreen.width;
        const left: Animated.Value = new Animated.Value(
            props.isOpen
                ? props.openMenuOffset * initialMenuPositionMultiplier
                : props.hiddenMenuOffset,
        );

        const scale: Animated.Value = new Animated.Value(1);
        const round: Animated.Value = new Animated.Value(0);

        this.onLayoutChange = this.onLayoutChange.bind(this);
        this.onStartShouldSetResponderCapture = props.onStartShouldSetResponderCapture.bind(this);
        this.onMoveShouldSetPanResponder = this.handleMoveShouldSetPanResponder.bind(this);
        this.onPanResponderMove = this.handlePanResponderMove.bind(this);
        this.onPanResponderRelease = this.handlePanResponderEnd.bind(this);
        this.onPanResponderTerminate = this.handlePanResponderEnd.bind(this);

        this.state = {
            width: deviceScreen.width,
            height: deviceScreen.height,
            openOffsetMenuPercentage,
            openMenuOffset: deviceScreen.width * openOffsetMenuPercentage,
            hiddenMenuOffsetPercentage,
            hiddenMenuOffset: deviceScreen.width * hiddenMenuOffsetPercentage,
            left,
            scale,
            round,
        };

        this.state.left.addListener(({ value }) => this.props.onSliding(Math.abs((value - this.state.hiddenMenuOffset) / (this.state.openMenuOffset - this.state.hiddenMenuOffset))));
    }

    componentWillMount(): void {
        this.responder = PanResponder.create({
            onStartShouldSetResponderCapture: this.onStartShouldSetResponderCapture,
            onMoveShouldSetPanResponder: this.onMoveShouldSetPanResponder,
            onPanResponderMove: this.onPanResponderMove,
            onPanResponderRelease: this.onPanResponderRelease,
            onPanResponderTerminate: this.onPanResponderTerminate,
        });
    }

    componentWillReceiveProps(props: Props): void {
        if (typeof props.isOpen !== 'undefined' && this.isOpen !== props.isOpen && (props.autoClosing || this.isOpen === false)) {
            this.openMenu(props.isOpen);
        }
    }

    onLayoutChange(e: Event) {
        const { width, height } = e.nativeEvent.layout;
        const openMenuOffset = width * this.state.openOffsetMenuPercentage;
        const hiddenMenuOffset = width * this.state.hiddenMenuOffsetPercentage;
        this.setState({ width, height, openMenuOffset, hiddenMenuOffset });
    }

    /**
     * Get content view. This view will be rendered over menu
     * @return {React.Component}
     */
    getContentView() {
        let overlay: React.Element<void, void> = null;

        if (this.isOpen) {
            overlay = (
                <TouchableWithoutFeedback onPress={() => this.openMenu(false)}>
                    <View style={styles.overlay} />
                </TouchableWithoutFeedback>
            );
        }

        const { width, height } = this.state;
        const ref = sideMenu => (this.sideMenu = sideMenu);
        const style = [
            styles.frontView,
            { width, height },

            this.props.animationStyle(this.state.left, this.state.scale, this.state.round),
        ];

        return (
                <Animated.View style={[style, {overflow:'visible', shadowColor: '#000', shadowRadius: 30, shadowOpacity: 0.35, shadowOffset: {width: 0, height: 4} }]} ref={ref} {...this.responder.panHandlers} shouldRasterizeIOS>
                    <Animated.View style={{flex: 1, borderRadius: this.state.round, overflow: 'hidden'}}>
                    {this.props.children}
                    {overlay}
                    </Animated.View>
                </Animated.View>
        );
    }

    moveLeft(offset: number) {
        const newOffset = this.menuPositionMultiplier() * offset;

        Animated.parallel([
            this.props.animationFunction(this.state.left, newOffset),
            this.props.animationFunction(this.state.scale, this.isOpen ? 1 : 0.9),
            this.props.animationFunction(this.state.round, this.isOpen ? 0 : 30)
        ]).start()

        this.prevLeft = newOffset;
    }

    menuPositionMultiplier(): -1 | 1 {
        return this.props.menuPosition === 'right' ? -1 : 1;
    }

    handlePanResponderMove(e: Object, gestureState: Object) {
        if (this.state.left.__getValue() * this.menuPositionMultiplier() >= 0) {
            let newLeft = this.prevLeft + gestureState.dx;

            if (!this.props.bounceBackOnOverdraw && Math.abs(newLeft) > this.state.openMenuOffset) {
                newLeft = this.menuPositionMultiplier() * this.state.openMenuOffset;
            }

            this.props.onMove(newLeft);
            const procent = newLeft / this.state.openMenuOffset
            this.state.round.setValue(procent * 30);
            // this.state.round.setOffset(procent * 30)
            // this.state.scale.setValue(1-(procent * 0.1))
            this.state.left.setValue(newLeft);
        }
    }

    handlePanResponderEnd(e: Object, gestureState: Object) {
        const offsetLeft = this.menuPositionMultiplier() *
            (this.state.left.__getValue() + gestureState.dx);

        this.openMenu(shouldOpenMenu(offsetLeft));
    }

    handleMoveShouldSetPanResponder(e: any, gestureState: any): boolean {
        if (this.gesturesAreEnabled()) {
            const x = Math.round(Math.abs(gestureState.dx));
            const y = Math.round(Math.abs(gestureState.dy));

            const touchMoved = x > this.props.toleranceX && y < this.props.toleranceY;

            if (this.isOpen) {
                return touchMoved;
            }

            const withinEdgeHitWidth = this.props.menuPosition === 'right' ?
                gestureState.moveX > (deviceScreen.width - this.props.edgeHitWidth) :
                gestureState.moveX < this.props.edgeHitWidth;

            const swipingToOpen = this.menuPositionMultiplier() * gestureState.dx > 0;
            return withinEdgeHitWidth && touchMoved && swipingToOpen;
        }

        return false;
    }

    openMenu(isOpen: boolean): void {
        const { hiddenMenuOffset, openMenuOffset } = this.state;
        this.moveLeft(isOpen ? openMenuOffset : hiddenMenuOffset);
        this.isOpen = isOpen;

        this.forceUpdate();
        this.props.onChange(isOpen);
    }

    gesturesAreEnabled(): boolean {
        const { disableGestures } = this.props;

        if (typeof disableGestures === 'function') {
            return !disableGestures();
        }

        return !disableGestures;
    }

    render(): React.Element<void, void> {
        const boundryStyle = this.props.menuPosition === 'right' ?
            { left: this.state.width - this.state.openMenuOffset } :
            { right: this.state.width - this.state.openMenuOffset };

        const menu = (
            <View style={[styles.menu, boundryStyle]}>
                {this.props.menu}
            </View>
        );

        return (
            <View
                style={styles.container}
                onLayout={this.onLayoutChange}
            >
                {menu}
                {this.getContentView()}
            </View>
        );
    }
}

SideMenu.propTypes = {
    edgeHitWidth: PropTypes.number,
    toleranceX: PropTypes.number,
    toleranceY: PropTypes.number,
    menuPosition: PropTypes.oneOf(['left', 'right']),
    onChange: PropTypes.func,
    onMove: PropTypes.func,
    children: PropTypes.node,
    menu: PropTypes.node,
    openMenuOffset: PropTypes.number,
    hiddenMenuOffset: PropTypes.number,
    animationStyle: PropTypes.func,
    disableGestures: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    animationFunction: PropTypes.func,
    onStartShouldSetResponderCapture: PropTypes.func,
    isOpen: PropTypes.bool,
    bounceBackOnOverdraw: PropTypes.bool,
    autoClosing: PropTypes.bool,
};

SideMenu.defaultProps = {
    toleranceY: 10,
    toleranceX: 10,
    edgeHitWidth: 60,
    children: null,
    menu: null,
    openMenuOffset: deviceScreen.width * (3 / 4),
    disableGestures: false,
    menuPosition: 'left',
    hiddenMenuOffset: 0,
    onMove: () => { },
    onStartShouldSetResponderCapture: () => true,
    onChange: () => { },
    onSliding: () => { },
    animationStyle: (value, scale, round) => ({
        transform: [{ translateX: value }, { scale: scale }],
        borderRadius: round,

    }),
    animationFunction: (prop, value) => Animated.spring(prop, {
        toValue: value,
        friction: 8,
        useNativeDriver: true,
    }),
    isOpen: false,
    bounceBackOnOverdraw: true,
    autoClosing: true,
};
