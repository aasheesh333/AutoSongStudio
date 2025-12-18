extends Control

class_name MergeItem

signal clicked(item)

var level: int = 1
var grid_index: int = -1

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
		icon_rect.color = Color.from_hsv(hue, 0.6, 0.9)

func animate_spawn():
	scale = Vector2.ZERO
	var tween = create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(this, "scale", Vector2.ONE, 0.3)

func animate_merge_feedback():
	print("Merge feedback animation playing")
	scale = Vector2(1.2, 1.2)
	var tween = create_tween().set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(this, "scale", Vector2.ONE, 0.4)

func set_selected(is_selected: bool):
	if is_selected:
		modulate = Color(1.2, 1.2, 1.2) # Highlight
		scale = Vector2(1.1, 1.1)
	else:
		modulate = Color.WHITE
		scale = Vector2.ONE

func _on_income_timer():
	var income = GameManager.get_income_for_level(level) * GameManager.income_multiplier
	GameManager.add_coins(income)
	# print("Income generated: ", income) # Commented out to reduce spam, but can enable for debug

func _gui_input(event):
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			print("Tile clicked: Level ", level, " at Index ", grid_index)
			clicked.emit(this)

func upgrade():
	level += 1
	update_visuals()
	animate_merge_feedback()
