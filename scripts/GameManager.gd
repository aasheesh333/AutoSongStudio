extends Node

# Singleton: GameManager
# Handles Economy, Save/Load, and Offline Earnings

signal coins_changed(new_amount)

var coins: float = 0.0
var income_multiplier: float = 1.0
var last_login_time: int = 0
var grid_data: Dictionary = {} # Key: Grid Index (int), Value: Level (int)

const SAVE_PATH = "user://savegame.save"

func _ready():
	load_game()
	calculate_offline_earnings()

	# Auto-save timer
	var timer = Timer.new()
	timer.wait_time = 30.0
	timer.autostart = true
	timer.timeout.connect(save_game)
	add_child(timer)

func add_coins(amount: float):
	coins += amount
	emit_signal("coins_changed", coins)

func spend_coins(amount: float) -> bool:
	if coins >= amount:
		coins -= amount
		emit_signal("coins_changed", coins)
		save_game()
		return true
	return false

func get_income_for_level(level: int) -> float:
	# Base 1, x1.5 per level
	return pow(1.5, level - 1)

func update_grid_state(index: int, level: int):
	grid_data[index] = level
	# Note: We don't save immediately on every merge to save IO,
	# but relies on auto-save or explicit save triggers.

func remove_grid_item(index: int):
	if grid_data.has(index):
		grid_data.erase(index)

func save_game():
	var save_dict = {
		"coins": coins,
		"income_multiplier": income_multiplier,
		"last_login_time": Time.get_unix_time_from_system(),
		"grid_data": grid_data
	}

	var file = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		var json_string = JSON.stringify(save_dict)
		file.store_string(json_string)
		file.close()
		# print("Game Saved")

func load_game():
	if not FileAccess.file_exists(SAVE_PATH):
		coins = 0 # Starter coins
		return

	var file = FileAccess.open(SAVE_PATH, FileAccess.READ)
	var content = file.get_as_text()
	file.close()

	var json = JSON.new()
	var error = json.parse(content)
	if error == OK:
		var data = json.data
		coins = data.get("coins", 0.0)
		income_multiplier = data.get("income_multiplier", 1.0)
		last_login_time = data.get("last_login_time", 0)
		# Convert float keys back to int if JSON parsed them as strings/floats
		var loaded_grid = data.get("grid_data", {})
		grid_data = {}
		for k in loaded_grid:
			grid_data[int(k)] = int(loaded_grid[k])
	else:
		print("Save file corrupted")

func calculate_offline_earnings():
	if last_login_time == 0:
		return

	var current_time = Time.get_unix_time_from_system()
	var seconds_passed = current_time - last_login_time

	if seconds_passed > 60:
		var total_income_per_sec = 0.0
		for level in grid_data.values():
			total_income_per_sec += get_income_for_level(level)

		var earnings = total_income_per_sec * seconds_passed * 0.5 # 50% offline efficiency
		if earnings > 0:
			add_coins(earnings)
			print("Offline Earnings: ", earnings)
			# TODO: Show popup
