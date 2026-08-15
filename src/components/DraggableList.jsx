/**
 * DraggableList.jsx — Long-press to lift, drag to reorder.
 *
 * Touch-dragging inside a scrolling list fights the scroll gesture: every
 * attempt to scroll past a row starts a drag instead. Requiring a long press
 * to lift a row first separates the two intentions completely, at the cost of
 * a third of a second.
 *
 * Rows are a fixed height so the target index is arithmetic rather than
 * measurement — measuring every row would mean a layout pass per frame.
 *
 * Works under react-native-web, so it's fine in the PWA. Falls back to the
 * arrow buttons on any row where dragging is disabled.
 */

import React, { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, PanResponder, Animated, StyleSheet } from 'react-native';
import { colors, radius, spacing, text } from '../theme/tokens.js';

export const ROW_HEIGHT = 64;

export default function DraggableList({ items, renderItem, onReorder, disabled, keyExtractor }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const pan = useRef(new Animated.Value(0)).current;

  // Refs because the PanResponder closure is created once and would otherwise
  // capture the first render's values forever.
  const dragIndexRef = useRef(null);
  const hoverRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Only claims the gesture once a row has been lifted, so the list
      // scrolls normally the rest of the time.
      onMoveShouldSetPanResponder: () => dragIndexRef.current !== null,
      onPanResponderMove: (_, gesture) => {
        if (dragIndexRef.current === null) return;
        pan.setValue(gesture.dy);
        const offset = Math.round(gesture.dy / ROW_HEIGHT);
        const target = Math.max(
          0,
          Math.min(itemsRef.current.length - 1, dragIndexRef.current + offset)
        );
        if (target !== hoverRef.current) {
          hoverRef.current = target;
          setHoverIndex(target);
        }
      },
      onPanResponderRelease: () => {
        const from = dragIndexRef.current;
        const to = hoverRef.current;
        if (from !== null && to !== null && from !== to) {
          const next = [...itemsRef.current];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          onReorder(next);
        }
        dragIndexRef.current = null;
        hoverRef.current = null;
        setDragIndex(null);
        setHoverIndex(null);
        pan.setValue(0);
      },
      onPanResponderTerminate: () => {
        dragIndexRef.current = null;
        hoverRef.current = null;
        setDragIndex(null);
        setHoverIndex(null);
        pan.setValue(0);
      },
    })
  ).current;

  const lift = useCallback((index) => {
    if (disabled) return;
    dragIndexRef.current = index;
    hoverRef.current = index;
    setDragIndex(index);
    setHoverIndex(index);
    pan.setValue(0);
  }, [disabled, pan]);

  return (
    <View {...(disabled ? {} : responder.panHandlers)}>
      {items.map((item, i) => {
        const isDragging = dragIndex === i;

        // Rows between the lifted row and where it's hovering slide out of the
        // way, so the gap always shows where it will land.
        let shift = 0;
        if (dragIndex !== null && hoverIndex !== null && !isDragging) {
          if (dragIndex < hoverIndex && i > dragIndex && i <= hoverIndex) shift = -ROW_HEIGHT;
          else if (dragIndex > hoverIndex && i >= hoverIndex && i < dragIndex) shift = ROW_HEIGHT;
        }

        return (
          <Animated.View
            key={keyExtractor ? keyExtractor(item, i) : i}
            style={[
              styles.row,
              { transform: [{ translateY: isDragging ? pan : shift }] },
              isDragging && styles.dragging,
            ]}
          >
            <Pressable
              onLongPress={() => lift(i)}
              delayLongPress={280}
              disabled={disabled}
              style={styles.press}
            >
              {renderItem(item, i, isDragging)}
            </Pressable>
          </Animated.View>
        );
      })}

      {!disabled && items.length > 1 && (
        <Text style={styles.hint}>Press and hold a player to move them.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, justifyContent: 'center' },
  press: { flex: 1, justifyContent: 'center' },
  dragging: {
    zIndex: 10,
    shadowColor: colors.navy, shadowOpacity: 0.22, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  hint: {
    ...text.body, fontSize: 11.5, color: colors.pencil,
    textAlign: 'center', paddingVertical: spacing.md,
  },
});
