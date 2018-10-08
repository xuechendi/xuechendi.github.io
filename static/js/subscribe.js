(function () {	
	//subscribe
	function subscribe_to_server () {
		var email = $("#subscribe-input").val();
		$.ajax({
			url: "http://ec2-13-59-71-153.us-east-2.compute.amazonaws.com/subscribe",
			type: 'post',
			dataType: 'text',
			data: email
		}).done(function(data) {
			$("div.subscribe-block-feedback").text("Successfully subscribed!");
		});
	}
	
	function unsubscribe_to_server () {
		var email = $("#subscribe-input").val();
		$.ajax({
			url: "http://ec2-13-59-71-153.us-east-2.compute.amazonaws.com/unsubscribe",
			type: 'post',
			dataType: 'text',
			data: email
		}).done(function(data) {
			$("div.subscribe-block-feedback").text("Successfully unsubscribed!");
		});
	}
	
	$("#subscribe-block-button-sub").click(function(){
		subscribe_to_server ();
	});
	
	$("#subscribe-block-button-unsub").click(function(){
		unsubscribe_to_server ();
	});
	
	$(document).ready(function(){
		$.ajax({
			url: "http://ec2-13-59-71-153.us-east-2.compute.amazonaws.com/subscribe_status",
			type: 'get',
			dataType: 'text'
		}).done(function(data) {
			$("div.subscribe-block-status p").text(data);
		});
	});
})(jQuery)