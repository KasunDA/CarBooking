var a = a || {};

$(document).ready(function () {
	a.b = (function Init(){
		var c = {};

		c.today_date = new Date();
		c.activeweek_date = new Date();
		c.edited_car = null;
		c.resources = [];
		c.relative_url = (_spPageContextInfo.webServerRelativeUrl + "/").replace("//", "/");

		c.time_offset_client = (0 - (new Date).getTimezoneOffset()) * 60000;		//client's time zone
		c.time_offset_server = 4 * 3600000;		//time zone set on the server

		c.list_bookings = "CarBooking";		//REST list names
		c.list_permissions = "CarBooking_Permissions";
		c.list_resources = "CarBooking_Resources";
		c.list_notifications = "Notifications";

		Start();

		c.car_popup = $(".carPopup");
		c.car_timeFrom = c.car_popup.find("#carTimeFrom");
		c.car_timeTo = c.car_popup.find("#carTimeTo");
		c.car_owner = c.car_popup.find("#carOwner");
		c.car_selected = c.available_cars = c.car_popup.find("#carsAvailable");
		c.car_comments = c.car_popup.find("#carComments");
		c.car_filter = $("#carFilter");

		c.car_filter.change(function(){ c.viewModel.filter($(this).val()); });		//on car_filter change


		function Start(){
			$.when(GetCurrentUser(), GetPermissions()).done(function(){
				SetDates(); 
				GetBookings();
			});
			c.viewModel = new ViewModel();
			SetDesign();
			GetAllResources();
			ko.applyBindings(c.viewModel);
			ExecuteOrDelayUntilScriptLoaded(function(){}, "sp.js");		//for SP.UI.Notify class
		}


		function GetCurrentUser() {
			var deferred = $.Deferred();
			$.getJSON("/_vti_bin/listdata.svc/UserInformationList(" + _spPageContextInfo.userId + ")?$select=Account,Name", function(data) {
				c.me = (data.d.Account).toLowerCase() + ";";
				c.my_name = data.d.Name;
				deferred.resolve();
			}).fail(function(){
				alert("error getting current user information");
				deferred.reject();
			});
			return deferred.promise();
		}


		function GetPermissions(){
			var deferred = $.Deferred();
			c.bypass_rules = "";
			$.getJSON(c.relative_url + "_vti_bin/listdata.svc/" + c.list_permissions + "(1)?$select=BypassRules/Account,CarManager/Account,InAdvanceSchedule&$expand=BypassRules,CarManager", function(data){
				if (data.d.BypassRules.results){
					for(i in data.d.BypassRules.results){
						var result = data.d.BypassRules.results[i];
						c.bypass_rules += result.Account.toLowerCase() + ";";		//list of employees who bypass car booking restrictions
					}
				}
				c.car_manager = (data.d.CarManager.results[0] ? (data.d.CarManager.results[0].Account.toLowerCase() + ";") : "");		//car manager
				c.inadvance_days = data.d.InAdvanceSchedule;		//number of days users are allowed to schedule in advance for
				deferred.resolve();
			}).fail(function(){
				alert("error getting car booking permissions");
				deferred.reject();
			});
			return deferred.promise();
		}


		function SetDates(){		//set dates for each cell and add New Car (+) button
			var active_day = c.activeweek_date.getDay();
			c.monday = new Date(c.activeweek_date.valueOf() - (active_day - 1) * 86400000);		//active week's monday;
			c.friday = new Date(c.activeweek_date.valueOf() + (5 - active_day) * 86400000);		//active week's friday;
			$(".carWeek").text(c.monday.toDateString() + " - " + c.friday.toDateString());

			$(".weekTitles td").each(function(index){
				var self = $(this);
				if (self.text() != "Filter"){
					var self_date = new Date(c.monday.valueOf() + (index * 86400000));
					self.text(self_date.toDateString());
					if (self_date >= c.today_date){
						if (c.car_manager == c.me || c.inadvance_days == null || c.bypass_rules.indexOf(c.me) > -1){		//if i'm a car manager || 'in advance schedule' limit not set || i can bypass that limit
							AddPlusButton(self);
						}
						else {
							if (c.today_date.getDay() < 5 && self_date < (new Date(c.today_date.valueOf() + (c.inadvance_days * 86400000)))){		//add New Car (+) button for a number of days set by the limit
								AddPlusButton(self);
							}
							if (c.today_date.getDay() >= 5 && self_date < (new Date(c.today_date.valueOf() + ((2 + c.inadvance_days) * 86400000)))){		//from Friday to Sunday add (+) button for the next Monday at least
								AddPlusButton(self);
							}
						}
					}
				}
			});
		}

		function AddPlusButton(self){
			self.append('<img src="/_layouts/images/newrowheader.png" class="carAdd carClickable" onclick="a.b.BookNewCar(this)">');
		}


		function SetDesign(){
			$(".weekDay:first").append(DrawWeekDays(1,3));
			$(".weekDay:last").append(DrawWeekDays(4,5)).append('<td class="carFilter"><select id="carFilter"></td>');
		}


		function GetBookings(){
			$.getJSON(c.relative_url + "_vti_bin/listdata.svc/" + c.list_bookings + "?$select=Owner_Login,Owner_,Details,Comments,Resource,From,To&$orderby=From", function(data){
			
				for (var i=1; i<=5; i++) {
					c.viewModel["Cars" + i]([]);		//clear all Car arrays
				}

				for(i in data.d.results){
					var result = data.d.results[i];
					var date = ConvertRestToDate(result.From);
					var day = date.getDay();
					if (date >= c.monday.setHours(0) && date <= c.friday.setHours(23)) {
						c.viewModel["Cars" + day]().push(new Car(result));
					}
				}

				for (var i=1; i<=5; i++) {
					c.viewModel["Cars" + i].valueHasMutated();
				}
				SetFloatingPopup();
			}).fail(function(){
				alert("error getting bookings");
			});
		}


		function BookNewCar(cell){
			c.car_date = cell.previousSibling.data;
			var now = new Date();
			var hours = now.getHours();
			var minutes = now.getMinutes();

			switch(true){
				case (minutes >= 0 && minutes < 15):
					SetTime(hours, "16", hours + 1, "15");
					break;
				case (minutes >= 15 && minutes < 30):
					SetTime(hours, "31", hours + 1, "30");
					break;
				case (minutes >= 30 && minutes < 45):
					SetTime(hours, "46", hours + 1, "45");
					break;
				case (minutes >= 45 && minutes <= 59):
					SetTime(hours + 1, "01", hours + 2, "00");
					break;
			}

			ShowCarPopup();
		}


		function GetAllResources(){
			$.getJSON(c.relative_url + "_vti_bin/listdata.svc/" + c.list_resources + "?$select=Title,DriverName,DriverPhone", function(data){
				var filter = '<option value=""></option>';
				for (i in data.d.results) {
					var result = data.d.results[i];
					var resource = result.Title;
					filter += '<option value="' + resource + '">' + resource + '</option>';
					c.resources.push({"car": resource, "name": result.DriverName, "phone": result.DriverPhone});		//push to array of resources for future reference
				}
				c.car_filter.append(filter);		//add to car filter
			}).fail(function(){
				alert("error getting resources for filter");
			});
		}


		function GetAvailableResources(){
			c.opts = "";
			var calls = [];

			$(c.resources).each(function(index, resource){
				var deferred = $.Deferred();
				CheckIfResourceAvailable(resource.car, deferred, "check");
				calls.push(deferred);		//push to array of promises
			})

			$.when.apply($, calls).done(function(){			//when all promises resolved
				c.available_cars.find("option").detach();
				c.available_cars.append(c.opts);

				if (c.edited_car != null && c.opts.indexOf(c.edited_car.resource) > -1){		//if a car is being edited && opts contains its name
					c.available_cars.val(c.edited_car.resource);
				}
			});
		}


		function CheckIfResourceAvailable(resource, deferred, type){
			$.getJSON(c.relative_url + "_vti_bin/listdata.svc/" + c.list_bookings + "?$select=Details,From,To&$filter=((From ge datetime'" + c.grDate + "') and (From lt datetime'" + c.lesDate + "') and (Resource eq '" + resource + "'))", function(data){
				var ok;
				if (data.d.results.length){		//if there are results
					for (i in data.d.results) {
						var result = data.d.results[i];
						var from = ConvertRestToDate(result.From);
						var to = ConvertRestToDate(result.To);

						if (ok != false){
							if (to < c.car_dateFrom || from > c.car_dateTo || (c.edited_car != null && result.Details == c.edited_car.details)) {		//if there is no overlap || (if editing a car && result is the edited car)
								ok = true;
							}
							else { ok = false; }		//as long as there's a single overlap ok is false
						}
					}
				} else {		//if there are no results
					ok = true;
				}

				if (type == "check"){
					if (ok){
						c.opts += '<option value="' + resource + '">' + resource + '</option>';
					}	
					deferred.resolve();
				}
				else if (type == "recheck"){
					deferred.resolve(ok);
				}
			}).fail(function(){
				alert("error checking if car is available");
				deferred.resolve();
			});
			return deferred.promise();
		}


		function StartGettingResources(){
			NormalizeTime(c.car_timeFrom);
			NormalizeTime(c.car_timeTo);
			c.car_timeFrom.removeClass("error");
			c.car_timeTo.removeClass("error");

			var fullDate = new Date(c.car_date);
			c.grDate = SetRestTypeDates(fullDate);		//set dateFrom for REST query		
				fullDate = new Date(fullDate.valueOf() + 86400000);
			c.lesDate = SetRestTypeDates(fullDate);		//set dateTo for REST query

			c.car_dateFrom = new Date(c.car_date + " " + c.car_timeFrom.val());
			c.car_dateTo = new Date(c.car_date + " " + c.car_timeTo.val());

			if(c.car_dateFrom < c.car_dateTo && TimeOk(c.car_timeFrom.val()) && TimeOk(c.car_timeTo.val())) {		//if time is correct
				GetAvailableResources();
			}
			else {		//if time is not correct
				c.car_timeFrom.addClass("error");
				c.car_timeTo.addClass("error");
			}
		}


		function ShowCarPopup(data) {

			if (data == undefined) {		//if booking a new car
				c.car_ownerLogin = c.me;
				c.car_ownerName = c.my_name;
				c.car_owner.val(c.car_ownerName);
				c.car_comments.val("");

				c.edited_car = null;
			}
			else {			//if editing existing car
				var date = ConvertRestToDate(data.from);
				c.car_timeFrom.val(date.getHours() + ":" + date.getMinutes());		

				date = ConvertRestToDate(data.to);
				c.car_timeTo.val(date.getHours() + ":" + date.getMinutes());

				c.car_date = date.toDateString();
				c.car_owner.val(data.owner_name);
				c.car_comments.val(data.comments);

				c.edited_car = data;
			}

			StartGettingResources();

			c.car_popup.dialog({
				autoOpen: false,
				modal: true,
				width: 600,
				show: { effect: "drop", duration: 500 },
				hide: "drop",
				buttons: {
					OK: function() {
						var selected_car = c.car_selected.val();

						if (!c.car_timeFrom.hasClass("error") && selected_car != null) {		//if time and selected car are ok
							var recheck = $.Deferred();
							CheckIfResourceAvailable(selected_car, recheck, "recheck");
							$.when(recheck).done(function(reply){
								if (reply == true){
									Save();
									c.car_popup.dialog("close");
								}
								else {
									alert("Seems like " + selected_car + " has already been booked");
									GetBookings();
								}
							});
						}
						else {
							alert("Please check data entered");
						}
					},        
					Cancel: function() {
						$(this).dialog("close");
					}
				}
			})
			.dialog({title: "Book a car for " + c.car_date}).dialog("open");
		}


		function PrepareNotification(old_data, new_data, type){
			var self = this;
			var send_to;
			var driver;

			var html = "";
			var htmlHeading = "<i><span style='font-size:10.0pt;font-family:\"Verdana\",\"sans-serif\"'><a href=\"https://intranet">Intranet</a></span><br/><span style='font-size:24.0pt;font-family:\"Verdana\",\"sans-serif\"'>CAR BOOKING</span><hr size=2 width=\"100%\" align=center><br/></i>";
			self.html0 = "<b>Car: </b>";
			self.html1 = "<b>From: </b>";
			self.html2 = "<b>To: </b>";
			self.html3 = "<b>Comments: </b>";
			self.html4 = "<b>Owner: </b>";
			self.html5 = "<b>Driver: </b>";

			var new_ = [];

			if (new_data != null){
				new_.push(new_data.Resource, FormatDate(new_data.From), FormatDate(new_data.To), new_data.Comments || "", new_data.Owner_ || "", new_data.Owner_Login || "");
			}
			
			if (old_data != null) {		//editing (or deleting) existing car
				var old_ = [];
				old_.push(old_data.resource, FormatDate(ConvertRestToDate(old_data.from)), FormatDate(ConvertRestToDate(old_data.to)), old_data.comments || "", old_data.owner_name || "", old_data.owner || "");

				if (type == "delete"){		//deleting a car
					new_ = old_;
				}

				for (var i=0; i<=3; i++) {
					html += self["html" + i] + ((old_[i].toString() == new_[i].toString()) ? old_[i] : "<strike><i>" + old_[i] + "</i></strike><font color='red'> " + new_[i]) + "</font><br/>";
				}

				if (new_[4] != "" && old_[4] != new_[4]){		//owner has changed
					html += self.html4 + "<strike><i>" + old_[4] + "</i></strike><font color='red'> " + new_[4] + "</font><br/>";
					send_to = old_[5] + new_[5];
				} else {
					html += self.html4 + old_[4] + "<br/>";
					send_to = old_[5];
				}

				html += self.html5 + GetDriverDetails(old_data.resource);

				if (type == "delete"){		//deleting a car
					html = htmlHeading + "Dear " + old_[4] + ", your car booking has been <font color='red'>deleted</font>" + ((c.my_name == old_[4]) ? "" : " by " + c.my_name) + ".</br></br>" + html;
					CreateNotification(html, send_to, "DELETED (" + old_[1] + " - " + old_[2] + ")");
				}

				if (html.indexOf("<strike>") > -1){		//if there are updates
					html = htmlHeading + "Dear " + old_[4] + ", your car booking has been updated" + ((c.my_name == old_[4]) ? "" : " by " + c.my_name) + ".</br></br>" + html;
					CreateNotification(html, send_to, "UPDATED (" + old_[1] + " - " + old_[2] + ")");
				}

				
			} else {		//new car
				for (var i=0; i<=4; i++) {
					html += self["html" + i] + new_[i] + "<br/>";
				}
				send_to = new_[5] + c.me;
				html += self.html5 + GetDriverDetails(new_data.Resource);

				html = htmlHeading + "Dear " + new_[4] + ", new car booking has been created" + ((c.my_name == new_[4]) ? "" : " by " + c.my_name) + ".</br></br>" + html;
				CreateNotification(html, send_to, "CREATED (" + new_[1] + " - " + new_[2] + ")");
			}
		}


		function Save(){
			var data = {
				"Resource": c.car_selected.val(),
				"Comments": c.car_comments.val(),
				"From": new Date(c.car_dateFrom.valueOf() + (c.time_offset_client - c.time_offset_server)),
				"To": new Date(c.car_dateTo.valueOf() + (c.time_offset_client - c.time_offset_server)),
				"Owner_": c.car_ownerName,
				"Owner_Login": c.car_ownerLogin,
			}

			var url_ = c.relative_url + "_vti_bin/listdata.svc/" + c.list_bookings;
			var headers_ = {
					"Accept": "application/json;odata=verbose"
				};
			var notification = "<div><span>BOOKING SAVED</span></div>"

			if (c.edited_car != null) {
				url_ = c.edited_car.metadata.uri;
				headers_ = {
					"X-HTTP-Method": "MERGE",
					"If-Match": c.edited_car.metadata.etag
				};
				notification = "<div><span>BOOKING UPDATED</span></div>"
				c.item_id = url_.substring(url_.lastIndexOf("(") + 1).replace(")", "");		//item id for notifications
			}

			$.ajax({
				url: url_,
				type: "POST",
				processData: false,
				contentType: "application/json;odata=verbose",
				data: JSON.stringify(data),
				headers: headers_,
				success: function(data_) {
					if (SP.UI.Notify != undefined){
						SP.UI.Notify.addNotification(notification);
					}

					if (data_ != null){
						c.item_id = data_.d.Id.toString();		//item id for notifications
					}

					PrepareNotification(c.edited_car, data, null);
					GetBookings();
				},
				error: function() {
					alert("error saving car");
					document.location.reload();
				}
			});
		}


		function Delete(data){
			var url_ = data.metadata.uri;
			c.item_id = url_.substring(url_.lastIndexOf("(") + 1).replace(")", "");		//item id for notifications

			$.ajax({
				type: "POST",
				url: url_,
				headers: {
					"X-HTTP-Method": "DELETE",
					"If-Match": data.metadata.etag
				},
				success: function() {
					var notification = "<div><span>BOOKING DELETED</span></div>"
					if (SP.UI.Notify != undefined){
						SP.UI.Notify.addNotification(notification);
					}

					PrepareNotification(data, null, "delete");
					GetBookings();
				},
				error: function() {
					alert("error deleting car");
				}
			});
		}


		function Car(result){		//class
			var self = this;
			self.owner = result.Owner_Login;
			self.owner_name = result.Owner_;
			self.details = result.Details;
			self.comments = result.Comments;
			self.resource = result.Resource;
			self.from = result.From;
			self.to = result.To;
			self.metadata = result.__metadata;
			
			self.Visible = function(){
				if (self.owner == c.me || c.me == c.car_manager){
					return true;
				}
				return false;
			}

			self.Filter = function(){
				if (c.viewModel.filter() != "" && c.viewModel.filter() != self.resource){
					return false;
				}
				return true;
			}
		}


		function ViewModel(){		//viewmodel
			var self = this;
			self.Cars1 = ko.observableArray([]);
			self.Cars2 = ko.observableArray([]);
			self.Cars3 = ko.observableArray([]);
			self.Cars4 = ko.observableArray([]);
			self.Cars5 = ko.observableArray([]);

			self.Edit = function(data){
				ShowCarPopup(data);
			}

			self.Remove = function(data){
				var confirmed = confirm("Are you sure you want to DELETE '" + data.details + "' booking ?");
					if (confirmed) {
						Delete(data);
					}
			}

			self.filter = ko.observable("");
		}


		// utils

		function ConvertRestToDate(date){
			return new Date(parseInt(date.substring(6)) - c.time_offset_client);
		}

		function DrawWeekDays(k, j){
			var html = "";
			for (var i=k; i<=j; i++) {
				html += '<td>' +
							'<table>' + 
								'<tbody data-bind="foreach: Cars' + i + '">' + 
									'<tr data-bind="visible: Filter()"><td><span data-bind="text:details"></span></td><td>' +
									'<img data-bind="visible: Visible(), click: $parent.Remove.bind()" class="carClickable" src="/_layouts/images/cnsrej16.gif">' +
									'<img data-bind="visible: Visible(), click: $parent.Edit.bind()" class="carClickable" src="/_layouts/images/actionseditpage16.gif">' +
									'<span class="arrayIndex" data-bind="visible: false">' + i + '</span><span class="itemIndex" data-bind="visible: false, text:$index"></span>' + 
									'</td></tr>' +
								'</tbody>' +
							'</table>' +
						'</td>';
			}
			return html;
		}


		function SetTime(fhours, fminutes, thours, tminutes){
			c.car_timeFrom.val(fhours + ":" + fminutes);
			c.car_timeTo.val(thours + ":" + tminutes);
		}


		function NormalizeTime(time){
			var time_ = time.val();
			if (time_ != undefined && time_ != ""){
				var split = time_.split(":");
				var hours = split[0];
					hours = ((hours.length == 1) ? "0" + hours : hours);
				var minutes = split[1];
					minutes = ((minutes.length == 1) ? "0" + minutes : minutes);
				time.val(hours + ":" + minutes);
			}
		}


		function TimeOk(time){
			var regex = /^([01]?\d|2[0-3]):([0-5]?\d)$/;

			if(!time.match(regex)) {
				return false;
			}
			return true;
		}


		function SetRestTypeDates(fullDate){
			var date = fullDate.getDate().toString();
				date = ((date.length == 1) ? "0" + date : date);
			var month = (fullDate.getMonth() + 1).toString();
				month = ((month.length == 1) ? "0" + month : month);
			var year = fullDate.getUTCFullYear().toString();

			return (year + "-" + month + "-" + date);
		}


		function FormatDate(fullDate){
			var date = fullDate.toDateString();
			var hours = fullDate.getHours().toString();
				hours = ((hours.length == 1) ? "0" + hours : hours);
			var minutes = fullDate.getMinutes().toString()
				minutes = ((minutes.length == 1) ? "0" + minutes : minutes);

			return date + ", " + hours + ":" + minutes;
		}


		function CreateNotification(html, send_to, description) {
			var message = '<div style="color: #000000; font-family: verdana; font-size: 10pt;">' + html + '</div>';

			var data = {
				"Title": c.item_id,
				"Message": message,
				"To": send_to,
				"Source": "Car Booking",
				"Description": "Car Booking " + description,
			};

			$.ajax({
				url: c.relative_url + "_vti_bin/listdata.svc/" + c.list_notifications,
				type: "POST",
				processData: false,
				contentType: "application/json;odata=verbose",
				data: JSON.stringify(data),
				headers: {
					"Accept": "application/json;odata=verbose"
				},
				success: function(data) {
					var notification = "<div><span>NOTIFICATION SENT</span></div>"
					if (SP.UI.Notify != undefined){
						SP.UI.Notify.addNotification(notification);
					}
				},
				error: function (data) {
					alert("error creating notifications");
				}	
			});
		}


		function WeekArrowClicked(object){		//prev, next week arrows
			
			if (object.className.indexOf("RightArrow") > -1){
				c.activeweek_date = new Date(c.activeweek_date.valueOf() + 7 * 86400000);	
			}
			else {
				c.activeweek_date = new Date(c.activeweek_date.valueOf() - 7 * 86400000);
			}

			SetDates();
			GetBookings();

			if (c.car_filter.val() != ""){		//pulsate car filter if it's not blank
				c.car_filter.effect("pulsate");
			}
		}


		function SelectCarOwner(input){
			input.blur();
			PopupPeoplePicker();
		}


		function PreventChange(input){
			input.blur();
			input.value = c.car_ownerName;
		}


		function GetDriverDetails(car){
			var driver = ko.utils.arrayFilter(c.resources, function(f){
				return (f.car == car);
			});
			if (driver[0] != null){
				return driver[0].name + " [" + driver[0].phone + "]";
			}
			else { return "unknown"; }
		}


		function SetFloatingPopup() {
			$(".weekDay table tr").off().hover(function(event) { 
				var left = $(this).position().left + 130;
				var top = $(this).position().top + 20;
				event.stopPropagation();
				var arrayIndex = $(this).find(".arrayIndex").text();
				var itemIndex = $(this).find(".itemIndex").text();
				var theCar = c.viewModel["Cars" + arrayIndex]()[itemIndex];
				var driver = GetDriverDetails(theCar.resource);

				var html =	"<b>From:</b> " + FormatDate(ConvertRestToDate(theCar.from)) + "<br/>" +
							"<b>To:</b> " + FormatDate(ConvertRestToDate(theCar.to)) + "<br/>" +
							"<b>Car:</b> " + theCar.resource + "<br/>" +
							"<b>Comments:</b> " + (theCar.comments || "none") + "<br/>" +
							"<b>Owner:</b> " + theCar.owner_name + "<br/>" +
							"<b>Driver:</b> " + driver;

				$("#carPopup").html(html);
				$("#carPopup").css({"top": top, "left": left}).show();
			}, function() {
				$("#carPopup").hide();
			});
		}


		function CallbackForPeoplePickerPopup(xml){		//sets callback of people picker popup window
			if(xml==null)
				return;

			var xmlDoc = $.parseXML(xml);
			c.car_ownerName = xmlDoc.getElementsByTagName("Entity")[0].attributes[1].nodeValue;
			c.car_owner.val(c.car_ownerName);
			c.car_ownerLogin = xmlDoc.getElementsByTagName("Entity")[0].attributes[0].nodeValue.toLowerCase() + ";";
		}

		function PopupPeoplePicker(defaultSearch){		//people picker popup window
			//if(defaultSearch==undefined)
				//defaultSearch='';
			var sDialogUrl = c.relative_url + "_layouts/Picker.aspx?MultiSelect=False&CustomProperty=User,SecGroup,SPGroup;;15;;;False&DialogTitle=Select Owner&DialogImage=/_layouts/images/ppeople.gif&PickerDialogType=Microsoft.SharePoint.WebControls.PeoplePickerDialog, Microsoft.SharePoint, Version=14.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c";
			//sDialogUrl = sDialogUrl + '&DefaultSearch=' + escapeProperly(defaultSearch);
			var sFeatures="resizable: yes; status: no; scroll: no; help: no; center: yes; dialogWidth : 575px; dialogHeight : 500px; zoominherit : 1";

			commonShowModalDialog(sDialogUrl, sFeatures, CallbackForPeoplePickerPopup);
		}

		return {
			WeekArrowClicked: WeekArrowClicked,
			StartGettingResources: StartGettingResources,
			SelectCarOwner: SelectCarOwner,
			PreventChange: PreventChange,
			BookNewCar: BookNewCar,
		}

	})()
	//a.b = Init();	
});