extends Control

class_name MergeItem

var level: int = 1
var grid_index: int = -1

# Drag Logic
var _is_dragging = false
var _start_position = Vector2.zero
var _drag_offset = Vector2.zero

@onready var label = $LevelBadge/Label
@onready var icon_rect = $CardPanel/IconRect
@onready var card_panel = $CardPanel

func setup(p_level: int, p_index: int):
	level = p_level
	grid_index = p_index
	update_visuals()
	animate_spawn()

func _ready():
	# Start income timer
	var timer = Timer.new()
	timer.wait_time = 1.0
	timer.autostart = true
	timer.timeout.connect(_on_income_timer)
	add_child(timer)

func update_visuals():
	if label: label.text = str(level)
	if icon_rect:
		var hue = fmod(float(level) * 0.1, 1.0)
		# Update Icon Color
		icon_rect.color = Color.from_hsv(hue, 0.6, 0.9)

		# Optional: Update Border Color based on level/tier
		# var style = card_panel.get_theme_stylebox("panel").duplicate()
		# style.border_color = Color.from_hsv(hue, 0.5, 0.8)
		# card_panel.add_theme_stylebox_override("panel", style)

func animate_spawn():
	scale = Vector2.ZERO
	var tween = create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(this, "scale", Vector2.ONE, 0.3)

func animate_merge_feedback():
	# Pop effect
	scale = Vector2(1.2, 1.2)
	var tween = create_tween().set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(this, "scale", Vector2.ONE, 0.4)

	# Flash effect could be added here

func _on_income_timer():
	if not _is_dragging:
		var income = GameManager.get_income_for_level(level) * GameManager.income_multiplier
		GameManager.add_coins(income)

# --- Input Handling for Drag & Drop ---

func _gui_input(event):
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				start_drag(event.position)
			else:
				end_drag()
	elif event is InputEventScreenTouch:
		if event.pressed:
			start_drag(event.position)
		else:
			end_drag()
	elif event is InputEventMouseMotion or event is InputEventScreenDrag:
		if _is_dragging:
			global_position = get_global_mouse_position() - _drag_offset

func start_drag(local_pos):
	_is_dragging = true
	_start_position = global_position
	_drag_offset = get_global_mouse_position() - global_position
	z_index = 100

	# Scale up slightly while dragging
	var tween = create_tween()
	tween.tween_property(this, "scale", Vector2(1.1, 1.1), 0.1)

func end_drag():
	_is_dragging = false
	z_index = 0

	# Scale back
	var tween = create_tween()
	tween.tween_property(this, "scale", Vector2.ONE, 0.1)

	var dropped_on = get_drop_target()

	if dropped_on:
		if dropped_on.has_method("receive_drop"):
			dropped_on.receive_drop(this)
			return

	return_to_home()

func return_to_home():
	position = Vector2.ZERO

func get_drop_target():
	var slots = get_tree().get_nodes_in_group("slots")
	var center = global_position + size / 2.0

	for slot in slots:
		if slot.get_global_rect().has_point(center):
			return slot
	return null

func upgrade():
	level += 1
	update_visuals()
	animate_merge_feedback()
