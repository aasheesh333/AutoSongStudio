extends Control

class_name MergeItem

var level: int = 1
var grid_index: int = -1

# Drag Logic
var _is_dragging = false
var _start_position = Vector2.zero
var _home_position = Vector2.zero
var _drag_offset = Vector2.zero

@onready var label = $Label
@onready var color_rect = $ColorRect

func setup(p_level: int, p_index: int):
	level = p_level
	grid_index = p_index
	update_visuals()

func _ready():
	_home_position = position
	# Start income timer
	var timer = Timer.new()
	timer.wait_time = 1.0
	timer.autostart = true
	timer.timeout.connect(_on_income_timer)
	add_child(timer)

func update_visuals():
	if label: label.text = str(level)
	if color_rect:
		var hue = fmod(float(level) * 0.1, 1.0)
		color_rect.color = Color.from_hsv(hue, 0.7, 0.9)

func _on_income_timer():
	if not _is_dragging: # Only earn when settled? Or always. Let's say always.
		var income = GameManager.get_income_for_level(level) * GameManager.income_multiplier
		GameManager.add_coins(income)
		# Optional: Spawn floating text

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
	z_index = 100 # Bring to front
	# Parent to main canvas to avoid clipping?
	# For simple grid, simple z-index might work if parent sort is not issue.

func end_drag():
	_is_dragging = false
	z_index = 0

	# Raycast or check overlap to find drop target
	var dropped_on = get_drop_target()

	if dropped_on:
		if dropped_on.has_method("receive_drop"):
			dropped_on.receive_drop(this)
			return

	# If no valid drop, return home
	return_to_home()

func return_to_home():
	position = Vector2(0,0) # Local to slot

func get_drop_target():
	# Simple Area2D collision or manual distance check against all slots
	# Since slots are static UI controls, we can check rect overlap
	var slots = get_tree().get_nodes_in_group("slots")
	var center = global_position + size / 2.0

	for slot in slots:
		if slot.get_global_rect().has_point(center):
			return slot
	return null

func upgrade():
	level += 1
	update_visuals()
	# Play FX
